/**
 * Points API controller - endpoints powering the JuiceSwap "Juice Points" UI.
 *
 *   GET /points/:address          -> PointsBreakdown for this wallet
 *   GET /points/leaderboard       -> Top 100 wallets ranked by total points
 *
 * Anti-exploit guarantees (server-side, browser cannot influence):
 *   - Swap counts come from the `transactionSwap` table, which the indexer only
 *     populates for the official JuiceSwap V2/V3 routers (router-address whitelist
 *     enforced at indexer-handler level). Custom contracts emitting fake `Swap`
 *     events cannot be counted.
 *   - Reverted/uncled txs do not produce logs, so they cannot be counted.
 *   - Any swap whose blockNumber is within FINALITY_OFFSET_BLOCKS of the
 *     indexer's latest block is excluded (defence-in-depth against last-second reorgs).
 *   - Per-address daily cap (MAX_SWAP_POINTS_PER_DAY) deters micro-swap farming.
 *   - Fails closed: if `blockProgress` is unreadable we return 503 instead of
 *     silently dropping the finality filter.
 *
 * Performance notes:
 *   - Aggregation is pushed into Postgres (CTE + GROUP BY + SUM(LEAST(...)))
 *     so the API never streams the full swap history into Node memory.
 *   - Recommended composite index for fastest queries:
 *       CREATE INDEX IF NOT EXISTS transaction_swap_swapper_block
 *         ON "transactionSwap" ("swapperAddress", "blockNumber");
 *   - Address comparison uses the checksum form (no LOWER(...) wrap) so the
 *     index is actually used.
 *
 * Liquidity points are stubbed as 0 in this version - wiring time-weighted
 * minimum balance (`MIN_LIQUIDITY_USD` over 24h windows in whitelisted pools)
 * requires a per-day position-snapshot table that the indexer does not yet
 * write. This is tracked separately; the response shape is final so the
 * frontend will pick it up automatically once the snapshot indexer ships.
 */

import { and, count, desc, eq, lte, sql } from "drizzle-orm";
import { Context, Hono } from "hono";
import { getAddress, isAddress } from "viem";
import NodeCache from "node-cache";
// @ts-ignore
import { db } from "ponder:api";
// @ts-ignore
import { blockProgress, transactionSwap } from "ponder:schema";

const POINTS_PER_SWAP = 100;
const POINTS_PER_LIQUIDITY_DAY = 50;
const MIN_LIQUIDITY_USD = 10;
const MAX_SWAP_POINTS_PER_DAY = 1_000; // = 10 swaps per UTC day per address
const FINALITY_OFFSET_BLOCKS = 32;
const LEADERBOARD_LIMIT = 100;

const POINTS_CACHE_TTL_S = 30;
const LEADERBOARD_CACHE_TTL_S = 30;

interface LeaderboardEntry {
  rank: number;
  address: string;
  points: number;
}

interface LeaderboardPayload {
  entries: LeaderboardEntry[];
  updatedAt: number;
}

const pointsCache = new NodeCache({ stdTTL: POINTS_CACHE_TTL_S, checkperiod: 5, useClones: false });
const leaderboardCache = new NodeCache({ stdTTL: LEADERBOARD_CACHE_TTL_S, checkperiod: 5, useClones: false });

const SECONDS_PER_DAY = 86_400;

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

class FinalityUnknownError extends Error {
  constructor() {
    super("blockProgress unavailable - cannot enforce finality cutoff");
    this.name = "FinalityUnknownError";
  }
}

/**
 * Returns the latest block we are willing to count points for, applying
 * the finality buffer. Throws FinalityUnknownError if blockProgress cannot
 * be read - callers should translate that into 503 so we never silently
 * count unfinalized blocks.
 */
async function latestFinalizedBlock(): Promise<bigint> {
  const rows = await db.select().from(blockProgress).limit(1);
  if (!rows.length) {
    throw new FinalityUnknownError();
  }
  const latest = BigInt(rows[0].blockNumber);
  return latest > BigInt(FINALITY_OFFSET_BLOCKS)
    ? latest - BigInt(FINALITY_OFFSET_BLOCKS)
    : 0n;
}

function liquidityPointsStub(): PointsBreakdown["liquidity"] {
  return {
    days: 0,
    points: 0,
    currentUsdValue: 0,
    meetsMinimum: false,
  };
}

/**
 * One round-trip per-address aggregation:
 *   - GROUP BY UTC day to apply MAX_SWAP_POINTS_PER_DAY cap server-side
 *   - SUM the capped values to a single (swap_count, points) tuple
 * Index lookup on (swapperAddress) keeps this O(matches) regardless of
 * total transactionSwap row count.
 */
async function computeSwapPoints(
  checksumAddress: string,
  finalityCutoff: bigint,
): Promise<{ count: number; points: number }> {
  const dayExpr = sql`floor(${transactionSwap.blockTimestamp} / ${SECONDS_PER_DAY})`;

  const dailyCounts = db.$with("daily_counts").as(
    db
      .select({
        day: dayExpr.as("day"),
        n: count().as("n"),
      })
      .from(transactionSwap)
      .where(
        and(
          eq(transactionSwap.swapperAddress, checksumAddress),
          lte(transactionSwap.blockNumber, finalityCutoff),
        ),
      )
      .groupBy(dayExpr),
  );

  const rows = await db
    .with(dailyCounts)
    .select({
      swapCount: sql<string | number>`coalesce(sum(${dailyCounts.n}), 0)`.as(
        "swap_count",
      ),
      points:
        sql<string | number>`coalesce(sum(least(${dailyCounts.n} * ${POINTS_PER_SWAP}, ${MAX_SWAP_POINTS_PER_DAY})), 0)`.as(
          "points",
        ),
    })
    .from(dailyCounts);

  const row = rows[0];
  return {
    count: Number(row?.swapCount ?? 0),
    points: Number(row?.points ?? 0),
  };
}

async function buildBreakdown(
  checksumAddress: string,
  finalityCutoff: bigint,
): Promise<PointsBreakdown> {
  const swaps = await computeSwapPoints(checksumAddress, finalityCutoff);
  const liquidity = liquidityPointsStub();
  return {
    total: swaps.points + liquidity.points,
    swaps,
    liquidity,
  };
}

points.get("/leaderboard", async (c: Context) => {
  const cached = leaderboardCache.get<LeaderboardPayload>("top");
  if (cached) {
    return c.json(cached);
  }

  let finalityCutoff: bigint;
  try {
    finalityCutoff = await latestFinalizedBlock();
  } catch (err) {
    if (err instanceof FinalityUnknownError) {
      return c.json({ error: "Indexer not ready" }, 503);
    }
    console.error("blockProgress query error", err);
    return c.json({ error: "Failed to read indexer state" }, 500);
  }

  try {
    const dayExpr = sql`floor(${transactionSwap.blockTimestamp} / ${SECONDS_PER_DAY})`;

    // CTE 1: daily swap count per address.
    const dailyCounts = db.$with("daily_counts").as(
      db
        .select({
          addr: transactionSwap.swapperAddress,
          day: dayExpr.as("day"),
          n: count().as("n"),
        })
        .from(transactionSwap)
        .where(lte(transactionSwap.blockNumber, finalityCutoff))
        .groupBy(transactionSwap.swapperAddress, dayExpr),
    );

    // Outer: sum capped daily values per address, top N by points DESC.
    const pointsExpr =
      sql<string | number>`sum(least(${dailyCounts.n} * ${POINTS_PER_SWAP}, ${MAX_SWAP_POINTS_PER_DAY}))`;

    const rows: Array<{ addr: string; points: string | number }> = await db
      .with(dailyCounts)
      .select({
        addr: dailyCounts.addr,
        points: pointsExpr.as("points"),
      })
      .from(dailyCounts)
      .groupBy(dailyCounts.addr)
      .orderBy(desc(pointsExpr))
      .limit(LEADERBOARD_LIMIT);

    const entries: LeaderboardEntry[] = rows.map((row, i) => ({
      rank: i + 1,
      address: String(row.addr).toLowerCase(),
      points: Number(row.points),
    }));
    const payload: LeaderboardPayload = { entries, updatedAt: Date.now() };
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
  // Stored in checksum form by the indexer - preserve so the index is used.
  const checksumAddress = getAddress(raw);
  const cacheKey = checksumAddress.toLowerCase();

  const cached = pointsCache.get<PointsBreakdown>(cacheKey);
  if (cached) {
    return c.json(cached);
  }

  let finalityCutoff: bigint;
  try {
    finalityCutoff = await latestFinalizedBlock();
  } catch (err) {
    if (err instanceof FinalityUnknownError) {
      return c.json({ error: "Indexer not ready" }, 503);
    }
    console.error("blockProgress query error", err);
    return c.json({ error: "Failed to read indexer state" }, 500);
  }

  try {
    const breakdown = await buildBreakdown(checksumAddress, finalityCutoff);
    pointsCache.set(cacheKey, breakdown);
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
