/**
 * Points API controller — endpoints powering the JuiceSwap "Juice Points" UI.
 *
 *   GET /points/:address          → PointsBreakdown for this wallet
 *   GET /points/leaderboard       → Top 100 wallets ranked by total points
 *
 * Anti-exploit guarantees (server-side, browser cannot influence):
 *   - Swap counts come from the `transactionSwap` table, which the indexer only
 *     populates for the official JuiceSwap V2/V3 routers (router-address whitelist
 *     enforced at indexer-handler level). Custom contracts emitting fake `Swap`
 *     events cannot be counted.
 *   - Reverted/uncled txs do not produce logs, so they cannot be counted.
 *   - We exclude any swap whose blockNumber is within FINALITY_OFFSET of the
 *     indexer's latest block (defence-in-depth against last-second reorgs).
 *   - Per-address daily cap (MAX_SWAP_POINTS_PER_DAY) prevents micro-swap farming.
 *
 * Liquidity points are stubbed as 0 in this version — wiring time-weighted
 * minimum balance (`MIN_LIQUIDITY_USD` over 24h windows in whitelisted pools)
 * requires a per-day position-snapshot table that the indexer does not yet
 * write. This is tracked separately; the response shape is final so the
 * frontend will pick it up automatically once the snapshot indexer ships.
 */

import { eq, and, desc, count, sql, gte, lte } from "drizzle-orm";
import { Context, Hono } from "hono";
import { isAddress } from "viem";
import NodeCache from "node-cache";
// @ts-ignore
import { db } from "ponder:api";
// @ts-ignore
import { transactionSwap, blockProgress } from "ponder:schema";

const POINTS_PER_SWAP = 100;
const POINTS_PER_LIQUIDITY_DAY = 50;
const MIN_LIQUIDITY_USD = 10;
const MAX_SWAP_POINTS_PER_DAY = 1_000; // = 10 swaps per UTC day per address
const FINALITY_OFFSET_BLOCKS = 32;
const LEADERBOARD_LIMIT = 100;

const POINTS_CACHE_TTL_S = 30;
const LEADERBOARD_CACHE_TTL_S = 30;

const pointsCache = new NodeCache({ stdTTL: POINTS_CACHE_TTL_S, checkperiod: 5, useClones: false });
const leaderboardCache = new NodeCache({ stdTTL: LEADERBOARD_CACHE_TTL_S, checkperiod: 5, useClones: false });

const SECONDS_PER_DAY = 86_400n;

const points = new Hono();

interface PointsBreakdown {
  total: number;
  swaps: { count: number; points: number };
  liquidity: {
    days: number;
    points: number;
    currentUsdValue: number;
    meetsMinimum: boolean;
  };
}

async function latestFinalizedBlock(): Promise<bigint | null> {
  try {
    const rows = await db.select().from(blockProgress).limit(1);
    if (!rows.length) {
      return null;
    }
    const latest = BigInt(rows[0].blockNumber);
    return latest > BigInt(FINALITY_OFFSET_BLOCKS)
      ? latest - BigInt(FINALITY_OFFSET_BLOCKS)
      : 0n;
  } catch (err) {
    console.warn("blockProgress query failed", err);
    return null;
  }
}

/**
 * Aggregate finalized swap points for an address with a per-day cap to deter
 * micro-swap farming. Returns total swap points and underlying swap count.
 */
async function computeSwapPoints(
  address: string,
  finalityCutoff: bigint | null,
): Promise<{ count: number; points: number }> {
  const conditions = [
    sql`LOWER(${transactionSwap.swapperAddress}) = LOWER(${address})`,
  ];
  if (finalityCutoff !== null) {
    conditions.push(lte(transactionSwap.blockNumber, finalityCutoff));
  }

  // Pull just timestamp; aggregate per UTC day in JS (small dataset per wallet).
  const rows = await db
    .select({ ts: transactionSwap.blockTimestamp })
    .from(transactionSwap)
    .where(and(...conditions));

  if (!rows.length) {
    return { count: 0, points: 0 };
  }

  const perDay = new Map<string, number>();
  for (const row of rows) {
    const dayKey = String(BigInt(row.ts) / SECONDS_PER_DAY);
    perDay.set(dayKey, (perDay.get(dayKey) ?? 0) + 1);
  }

  let totalPoints = 0;
  for (const dayCount of perDay.values()) {
    totalPoints += Math.min(dayCount * POINTS_PER_SWAP, MAX_SWAP_POINTS_PER_DAY);
  }
  return { count: rows.length, points: totalPoints };
}

/**
 * Liquidity points scaffold. Returns zeros until the per-day position-snapshot
 * indexer is in place — see file header for what's required to ship this.
 */
function liquidityPointsStub(): {
  days: number;
  points: number;
  currentUsdValue: number;
  meetsMinimum: boolean;
} {
  return {
    days: 0,
    points: 0,
    currentUsdValue: 0,
    meetsMinimum: false,
  };
}

async function buildBreakdown(address: string): Promise<PointsBreakdown> {
  const finalityCutoff = await latestFinalizedBlock();
  const swaps = await computeSwapPoints(address, finalityCutoff);
  const liquidity = liquidityPointsStub();
  return {
    total: swaps.points + liquidity.points,
    swaps,
    liquidity,
  };
}

points.get("/leaderboard", async (c: Context) => {
  const cached = leaderboardCache.get<{ entries: any[]; updatedAt: number }>("top");
  if (cached) {
    return c.json(cached);
  }

  try {
    const finalityCutoff = await latestFinalizedBlock();
    const conditions = [];
    if (finalityCutoff !== null) {
      conditions.push(lte(transactionSwap.blockNumber, finalityCutoff));
    }

    const rows = await db
      .select({
        address: sql<string>`LOWER(${transactionSwap.swapperAddress})`.as("addr"),
        ts: transactionSwap.blockTimestamp,
      })
      .from(transactionSwap)
      .where(conditions.length ? and(...conditions) : undefined);

    const perAddress = new Map<string, number>();
    const perAddressDays = new Map<string, Map<string, number>>();
    for (const row of rows) {
      const addr = row.address;
      const dayKey = String(BigInt(row.ts) / SECONDS_PER_DAY);
      let days = perAddressDays.get(addr);
      if (!days) {
        days = new Map();
        perAddressDays.set(addr, days);
      }
      days.set(dayKey, (days.get(dayKey) ?? 0) + 1);
    }
    for (const [addr, days] of perAddressDays.entries()) {
      let total = 0;
      for (const dayCount of days.values()) {
        total += Math.min(dayCount * POINTS_PER_SWAP, MAX_SWAP_POINTS_PER_DAY);
      }
      if (total > 0) {
        perAddress.set(addr, total);
      }
    }

    const sorted = [...perAddress.entries()].sort((a, b) => b[1] - a[1]).slice(0, LEADERBOARD_LIMIT);
    const entries = sorted.map(([address, p], i) => ({
      rank: i + 1,
      address,
      points: p,
    }));
    const payload = { entries, updatedAt: Date.now() };
    leaderboardCache.set("top", payload);
    return c.json(payload);
  } catch (err) {
    console.error("leaderboard error", err);
    return c.json({ error: "Failed to compute leaderboard" }, 500);
  }
});

points.get("/:address", async (c: Context) => {
  const raw = c.req.param("address");
  if (!raw || !isAddress(raw)) {
    return c.json({ error: "Invalid address" }, 400);
  }
  const address = raw.toLowerCase();

  const cached = pointsCache.get<PointsBreakdown>(address);
  if (cached) {
    return c.json(cached);
  }

  try {
    const breakdown = await buildBreakdown(address);
    pointsCache.set(address, breakdown);
    return c.json(breakdown);
  } catch (err) {
    console.error("points error", err);
    return c.json({ error: "Failed to compute points" }, 500);
  }
});

export default points;

// Surface configuration for documentation / sanity checks (read-only).
export const POINTS_CONFIG = {
  POINTS_PER_SWAP,
  POINTS_PER_LIQUIDITY_DAY,
  MIN_LIQUIDITY_USD,
  MAX_SWAP_POINTS_PER_DAY,
  FINALITY_OFFSET_BLOCKS,
  LEADERBOARD_LIMIT,
};
