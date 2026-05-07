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
 * Liquidity points are stubbed as 0 in this version - wiring time-weighted
 * minimum balance (`MIN_LIQUIDITY_USD` over 24h windows in whitelisted pools)
 * requires a per-day position-snapshot table that the indexer does not yet
 * write. This is tracked separately; the response shape is final so the
 * frontend will pick it up automatically once the snapshot indexer ships.
 */

import { and, count, eq, lte, sql } from "drizzle-orm";
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

const pointsCache = new NodeCache({ stdTTL: POINTS_CACHE_TTL_S, checkperiod: 5, useClones: false });
const leaderboardCache = new NodeCache({
  stdTTL: LEADERBOARD_CACHE_TTL_S,
  checkperiod: 5,
  useClones: false,
});

const SECONDS_PER_DAY = 86_400;

const points = new Hono();

class FinalityUnknownError extends Error {
  constructor() {
    super("blockProgress unavailable - cannot enforce finality cutoff");
    this.name = "FinalityUnknownError";
  }
}

/**
 * Returns the latest block we are willing to count points for, applying
 * the finality buffer. Throws FinalityUnknownError if blockProgress cannot
 * be read - callers translate that to 503 so unfinalized blocks never count.
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
 * Per-address aggregation: GROUP BY UTC day, then apply the daily cap in JS.
 * The dataset is just one wallet's history, so the row count is bounded by
 * the number of distinct days that wallet was active.
 */
async function computeSwapPoints(
  checksumAddress: string,
  finalityCutoff: bigint,
): Promise<{ count: number; points: number }> {
  const dayExpr = sql<string>`floor(${transactionSwap.blockTimestamp} / ${SECONDS_PER_DAY})`;

  const rows = await db
    .select({
      day: dayExpr,
      n: count(),
    })
    .from(transactionSwap)
    .where(
      and(
        eq(transactionSwap.swapperAddress, checksumAddress),
        lte(transactionSwap.blockNumber, finalityCutoff),
      ),
    )
    .groupBy(dayExpr);

  let totalCount = 0;
  let totalPoints = 0;
  for (const row of rows) {
    const n = Number((row as { n: number | string | bigint }).n);
    if (!Number.isFinite(n)) {
      continue;
    }
    totalCount += n;
    totalPoints += Math.min(n * POINTS_PER_SWAP, MAX_SWAP_POINTS_PER_DAY);
  }
  return { count: totalCount, points: totalPoints };
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
    // Raw CTE: GROUP BY (address, day) -> SUM(LEAST(n*100, 1000)) per address.
    // Postgres returns just the top N rows; aggregation never streams to Node.
    const rawResult: any = await db.execute(sql`
      WITH daily_counts AS (
        SELECT
          ${transactionSwap.swapperAddress} AS addr,
          FLOOR(${transactionSwap.blockTimestamp} / ${SECONDS_PER_DAY}) AS day,
          COUNT(*)::int AS n
        FROM ${transactionSwap}
        WHERE ${transactionSwap.blockNumber} <= ${finalityCutoff}
        GROUP BY ${transactionSwap.swapperAddress},
                 FLOOR(${transactionSwap.blockTimestamp} / ${SECONDS_PER_DAY})
      )
      SELECT
        addr,
        SUM(LEAST(n * ${POINTS_PER_SWAP}, ${MAX_SWAP_POINTS_PER_DAY}))::bigint AS points
      FROM daily_counts
      GROUP BY addr
      HAVING SUM(LEAST(n * ${POINTS_PER_SWAP}, ${MAX_SWAP_POINTS_PER_DAY})) > 0
      ORDER BY points DESC
      LIMIT ${LEADERBOARD_LIMIT}
    `);

    // db.execute can return rows directly (postgres-js) or wrapped {rows:[...]} (pg).
    const rows: Array<{ addr: string; points: number | string | bigint }> = Array.isArray(rawResult)
      ? rawResult
      : (rawResult?.rows ?? []);

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
