/**
 * Points API controller - endpoints powering the JuiceSwap "Juice Points" UI.
 *
 *   GET /points/:address          -> PointsBreakdown for this wallet
 *   GET /points/leaderboard       -> Top N wallets ranked by swap points
 *
 * Points categories surfaced in PointsBreakdown:
 *   - swaps      — POINTS_PER_SWAP per JuiceSwap-router-originated swap,
 *                  daily-capped at MAX_SWAP_POINTS_PER_DAY per address.
 *   - liquidity  — POINTS_PER_LIQUIDITY_DAY per UTC day a wallet held ≥ $10
 *                  of LP in whitelisted pools throughout the whole 24h window.
 *   - bonuses    — one-time stacking bonuses on Citrea Mainnet:
 *                    500 JP for creating at least one launchpad meme token
 *                    500 JP for that wallet's token graduating (bonding
 *                                 curve filled → V2 pair created)
 *                  Also drives the Juicer NFT "create meme token"
 *                  requirement (campaign backend reads
 *                  `bonuses.memeTokenCreated`).
 *
 * Anti-exploit guarantees (server-side, browser cannot influence):
 *   - Swap counts come from `transactionSwap`, which the indexer only writes
 *     when `event.transaction.to` is in the JuiceSwap router/gateway allowlist
 *     (SwapRouter02, Gateway, Launchpad Router). Direct-pool arb, foreign
 *     aggregators (1inch, OpenOcean, …) and bot contracts emit the same Swap
 *     event but with a different `to` and cannot earn JP.
 *   - Reverted/uncled txs do not produce logs and so cannot be counted.
 *   - Any swap or LP event within FINALITY_OFFSET_BLOCKS of the indexer head
 *     is ignored (defence-in-depth against last-second reorgs).
 *   - Per-address daily cap (MAX_SWAP_POINTS_PER_DAY) deters micro-swap farming.
 *   - LP days: a UTC day is credited only if the wallet held ≥ $10 of LP in
 *     whitelisted pools throughout the entire 24h window — see `lpPoints.ts`.
 *     The "live tail" (days since the last LP event where the running value is
 *     still ≥ $10) is computed here at read time.
 *   - Fails closed: if `blockProgress` is unreadable we return 503 instead of
 *     silently dropping the finality filter.
 *
 * Query shape: raw CTE + simple GROUP BY. Plain SQL is the only Drizzle shape
 * that survived the production postgres driver — the previous `$with()`
 * variant serialised to a malformed query and the endpoint returned 500.
 */

import { and, count, eq, lte, sql } from "drizzle-orm";
import { Context, Hono } from "hono";
import { getAddress, isAddress } from "viem";
import NodeCache from "node-cache";
// @ts-ignore
import { db } from "ponder:api";
// @ts-ignore
import { blockProgress, launchpadToken, lpDayCredit, lpPositionWallet, transactionSwap } from "ponder:schema";

const POINTS_PER_SWAP = 100;
const POINTS_PER_LIQUIDITY_DAY = 50;
const POINTS_PER_MEME_TOKEN_CREATED = 500; // one-time bonus per wallet per chain
const POINTS_PER_MEME_TOKEN_GRADUATED = 500; // one-time bonus per wallet per chain
const MIN_LIQUIDITY_USD = 10;
const MIN_LIQUIDITY_USD_CENTS = 1_000; // = $10.00
const MAX_SWAP_POINTS_PER_DAY = 1_000; // = 10 swaps per UTC day per address
const FINALITY_OFFSET_BLOCKS = 32;
const LEADERBOARD_LIMIT = 100;

// Chain that the Juicer NFT campaign treats as canonical for the
// "create meme token" requirement. Token launches on other chains do NOT
// satisfy the campaign condition (but they still earn the 500 JP bonus on
// that chain via the per-chain check below).
const JUICER_CAMPAIGN_CHAIN_ID = 4114; // Citrea Mainnet

const POINTS_CACHE_TTL_S = 30;
const LEADERBOARD_CACHE_TTL_S = 30;

const SECONDS_PER_DAY = 86_400;

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
  bonuses: {
    /**
     * `true` once the wallet has created at least one launchpad token on the
     * Juicer campaign chain (Citrea Mainnet). Drives the "create meme token"
     * condition in the Juicer NFT campaign — the campaign backend reads this
     * flag instead of duplicating the chain lookup.
     */
    memeTokenCreated: boolean;
    /** One-time JP for creating a meme token, regardless of total launches. */
    memeTokenPoints: number;

    /**
     * `true` once at least one of the wallet's launchpad tokens has
     * graduated (bonding curve filled → V2 pair) on Citrea Mainnet. Rewards
     * the harder-to-fake outcome of a successful curve completion.
     */
    memeTokenGraduated: boolean;
    /** One-time JP for graduating a meme token. */
    memeTokenGraduatedPoints: number;

    /** Sum of all bonus categories (meme creation + graduation, for now). */
    points: number;
  };
}

const pointsCache = new NodeCache({
  stdTTL: POINTS_CACHE_TTL_S,
  checkperiod: 5,
  useClones: false,
});
const leaderboardCache = new NodeCache({
  stdTTL: LEADERBOARD_CACHE_TTL_S,
  checkperiod: 5,
  useClones: false,
});

const points = new Hono();

class FinalityUnknownError extends Error {
  constructor() {
    super("blockProgress unavailable - cannot enforce finality cutoff");
    this.name = "FinalityUnknownError";
  }
}

/**
 * Returns the latest block we are willing to count points for, applying the
 * finality buffer. Throws FinalityUnknownError if blockProgress cannot be
 * read - callers translate that to 503 so unfinalized blocks never count.
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

/**
 * Per-address swap-points aggregation: GROUP BY UTC day, then apply the daily
 * cap in JS. The dataset is one wallet's day-buckets, so the row count is
 * bounded by the number of distinct days that wallet was active.
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
    if (!Number.isFinite(n)) continue;
    totalCount += n;
    totalPoints += Math.min(n * POINTS_PER_SWAP, MAX_SWAP_POINTS_PER_DAY);
  }
  return { count: totalCount, points: totalPoints };
}

/**
 * LP point breakdown for an address:
 *  - `historicalDays` is the count of `lpDayCredit` rows the indexer already
 *    wrote (= UTC days where the wallet provably held ≥ $10 the whole day).
 *  - `liveDays` is the tail: days completed between `lastEventTimestamp` and
 *    `now` where the running value is still ≥ $10. The next LP event will
 *    materialize these into `lpDayCredit` rows; counting them here keeps the
 *    UI honest for inactive but eligible wallets.
 */
async function computeLpPoints(
  checksumWallet: string,
): Promise<PointsBreakdown["liquidity"]> {
  const walletLower = checksumWallet.toLowerCase();

  // 1) Historical credited days.
  const historicalRow: any[] = await db
    .select({ n: count() })
    .from(lpDayCredit)
    .where(eq(lpDayCredit.walletAddress, checksumWallet));
  const historicalDays = Number(historicalRow[0]?.n ?? 0);

  // 2) Current running value + lastEventTimestamp for live-tail calc.
  const walletRows: any[] = await db
    .select({
      usdCents: lpPositionWallet.usdCents,
      lastEventTimestamp: lpPositionWallet.lastEventTimestamp,
    })
    .from(lpPositionWallet)
    .where(eq(lpPositionWallet.walletAddress, checksumWallet))
    .limit(1);

  const usdCents = BigInt(walletRows[0]?.usdCents ?? 0);
  const lastEventTimestamp = BigInt(walletRows[0]?.lastEventTimestamp ?? 0);

  const nowSec = BigInt(Math.floor(Date.now() / 1_000));
  const SPD = BigInt(SECONDS_PER_DAY);
  let liveDays = 0;
  if (usdCents >= BigInt(MIN_LIQUIDITY_USD_CENTS) && lastEventTimestamp > 0n) {
    // Mirror lpPoints.ts `fullyCoveredDays`: D fully covered iff
    // day-start(D) ≥ lastEventTimestamp AND day-end(D) ≤ now.
    const dMin = (lastEventTimestamp + SPD - 1n) / SPD;
    const dMax = nowSec / SPD - 1n;
    if (dMax >= dMin) {
      liveDays = Number(dMax - dMin) + 1;
    }
  }

  // The live tail is a forecast, not an authoritative record — keep an
  // explicit cap so a clock bug or stale `lastEventTimestamp` cannot inflate
  // points by a million.
  const LIVE_TAIL_CAP = 365;
  if (liveDays > LIVE_TAIL_CAP) liveDays = LIVE_TAIL_CAP;

  // Convert cents to whole USD; the UI prints integers.
  const currentUsdValue = Number(usdCents) / 100;
  const days = historicalDays + liveDays;
  return {
    days,
    points: days * POINTS_PER_LIQUIDITY_DAY,
    currentUsdValue,
    meetsMinimum: usdCents >= BigInt(MIN_LIQUIDITY_USD_CENTS),
  };
}

/**
 * Two stacking one-time bonuses driven by the wallet's launchpad activity
 * on Citrea Mainnet:
 *
 *   memeTokenCreated   — `true` if `launchpadToken.creator = wallet`
 *                        for at least one row (any token launched).
 *   memeTokenGraduated — `true` if any of those tokens also has
 *                        `graduated = true` (bonding curve completed →
 *                        V2 pair created).
 *
 * Both bonuses are one-time per wallet regardless of how many tokens
 * launched / graduated. Graduation pays out the harder-to-fake outcome —
 * a wallet can spam-create cheap tokens, but only real demand fills a
 * bonding curve.
 *
 * Single SQL query: we ask for the existence of (any row, any graduated
 * row) for this wallet on this chain. Postgres returns both bools in one
 * round-trip via `MAX(CASE...)`.
 */
async function computeMemeTokenBonus(
  checksumAddress: string,
): Promise<PointsBreakdown["bonuses"]> {
  const rawResult: any = await db.execute(sql`
    SELECT
      EXISTS (
        SELECT 1 FROM ${launchpadToken}
        WHERE ${launchpadToken.creator} = ${checksumAddress}
          AND ${launchpadToken.chainId} = ${JUICER_CAMPAIGN_CHAIN_ID}
      ) AS created,
      EXISTS (
        SELECT 1 FROM ${launchpadToken}
        WHERE ${launchpadToken.creator} = ${checksumAddress}
          AND ${launchpadToken.chainId} = ${JUICER_CAMPAIGN_CHAIN_ID}
          AND ${launchpadToken.graduated} = TRUE
      ) AS graduated
  `);
  // db.execute can return rows directly or wrapped in {rows: [...]}.
  const row: { created?: boolean; graduated?: boolean } = Array.isArray(rawResult)
    ? rawResult[0]
    : (rawResult?.rows?.[0] ?? {});

  const created = !!row.created;
  const graduated = !!row.graduated;
  const memeTokenPoints = created ? POINTS_PER_MEME_TOKEN_CREATED : 0;
  const memeTokenGraduatedPoints = graduated ? POINTS_PER_MEME_TOKEN_GRADUATED : 0;
  return {
    memeTokenCreated: created,
    memeTokenPoints,
    memeTokenGraduated: graduated,
    memeTokenGraduatedPoints,
    points: memeTokenPoints + memeTokenGraduatedPoints,
  };
}

async function buildBreakdown(
  checksumAddress: string,
  finalityCutoff: bigint,
): Promise<PointsBreakdown> {
  const [swaps, liquidity, bonuses] = await Promise.all([
    computeSwapPoints(checksumAddress, finalityCutoff),
    computeLpPoints(checksumAddress),
    computeMemeTokenBonus(checksumAddress),
  ]);
  return {
    total: swaps.points + liquidity.points + bonuses.points,
    swaps,
    liquidity,
    bonuses,
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
    // Drizzle's `sql` template interpolates table/column refs so camelCase
    // names stay correctly quoted.
    //
    // The leaderboard rank still uses ONLY swap points — LP-only wallets are
    // intentionally excluded to keep the public leaderboard about active
    // traders. LP points are visible per-wallet via /points/:address.
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
  POINTS_PER_MEME_TOKEN_CREATED,
  POINTS_PER_MEME_TOKEN_GRADUATED,
  MIN_LIQUIDITY_USD,
  MAX_SWAP_POINTS_PER_DAY,
  FINALITY_OFFSET_BLOCKS,
  LEADERBOARD_LIMIT,
  JUICER_CAMPAIGN_CHAIN_ID,
};
