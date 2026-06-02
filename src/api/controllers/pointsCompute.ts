/**
 * Pure points-computation logic for the JuiceSwap "Juice Points" program.
 *
 * Extracted from `points.ts` so the aggregation logic can be exercised against
 * a real Postgres without the Ponder runtime (`ponder:api` / `ponder:schema`
 * virtual modules). Every function takes a Drizzle `db` handle as its first
 * argument; the Hono controller in `points.ts` binds the Ponder `db`, while
 * tests bind a node-postgres `db` over a seeded fixture database.
 *
 * Schema tables are imported from the schema file directly (not `ponder:schema`)
 * so this module resolves both under the Ponder runtime and standalone.
 *
 * See `points.ts` for the full anti-exploit / category documentation.
 */

import { and, count, eq, lte, sql, sum } from "drizzle-orm";
import * as ponderSchema from "../../../ponder.schema";

// Ponder's `onchainTable` bundles its own copy of drizzle-orm, whose Column
// types are nominally incompatible with the top-level drizzle-orm operators
// (`eq`/`and`/…) used below — a dual-package hazard that only affects types,
// not runtime. Alias the tables through `any` so the query builders compose;
// the Postgres-backed harness in `test/points` is the real correctness net.
const {
  blockProgress,
  juiceHoldDayCredit,
  juiceHoldWallet,
  launchpadToken,
  lendingDayCredit,
  lendingWallet,
  lpDayCredit,
  lpPositionWallet,
  savingsDayCredit,
  savingsWallet,
  transactionSwap,
} = ponderSchema as any;

export const POINTS_PER_SWAP = 100;
export const POINTS_PER_LIQUIDITY_DAY = 50;
export const POINTS_PER_MEME_TOKEN_CREATED = 500; // one-time bonus per wallet per chain
export const POINTS_PER_MEME_TOKEN_GRADUATED = 10_000; // one-time bonus per wallet per chain
// Daily-earning rates (per UTC day).
export const POINTS_PER_JUICE_PER_DAY = 1n; // 1 JP per 10 JUICE per day = floor(JUICE/10)
export const JUICE_PER_POINT = 10n;
export const POINTS_PER_JUSD_SAVED_PER_DAY = 1n;
export const POINTS_PER_USD_LENT_PER_DAY = 5n;
export const MIN_LIQUIDITY_USD = 10;
export const MIN_LIQUIDITY_USD_CENTS = 1_000; // = $10.00
export const MAX_SWAP_POINTS_PER_DAY = 1_000; // = 10 swaps per UTC day per address
export const FINALITY_OFFSET_BLOCKS = 32;
export const LEADERBOARD_LIMIT = 100;
export const LIVE_TAIL_CAP_DAYS = 365;
const ONE_TOKEN_18 = 10n ** 18n;

// Chain that the Juicer NFT campaign treats as canonical for the
// "create meme token" requirement.
export const JUICER_CAMPAIGN_CHAIN_ID = 4114; // Citrea Mainnet

export const SECONDS_PER_DAY = 86_400;

// A minimal structural type for the Drizzle handle we depend on. Both the
// Ponder `db` and a node-postgres Drizzle instance satisfy this.
export interface PointsDb {
  select: (...args: any[]) => any;
  execute: (...args: any[]) => any;
}

export interface LeaderboardEntry {
  rank: number;
  address: string;
  points: number;
}

export interface PointsBreakdown {
  total: number;
  swaps: { count: number; points: number };
  liquidity: {
    days: number;
    points: number;
    currentUsdValue: number;
    meetsMinimum: boolean;
  };
  bonuses: {
    memeTokenCreated: boolean;
    memeTokenPoints: number;
    memeTokenGraduated: boolean;
    memeTokenGraduatedPoints: number;
    savings: { jusdSaved: number; points: number };
    juiceHold: { juiceHeld: number; points: number };
    lending: { usdLent: number; points: number };
    points: number;
  };
}

export class FinalityUnknownError extends Error {
  constructor() {
    super("blockProgress unavailable - cannot enforce finality cutoff");
    this.name = "FinalityUnknownError";
  }
}

/**
 * Latest block we count points for, applying the finality buffer. Throws
 * FinalityUnknownError if blockProgress cannot be read.
 */
export async function latestFinalizedBlock(db: PointsDb): Promise<bigint> {
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
 *
 * Performance: address comparison uses the checksum form (no LOWER(...) wrap)
 * so an index on (swapperAddress, blockNumber) is actually used. Recommended:
 *   CREATE INDEX IF NOT EXISTS transaction_swap_swapper_block
 *     ON "transactionSwap" ("swapperAddress", "blockNumber");
 */
export async function computeSwapPoints(
  db: PointsDb,
  checksumAddress: string,
  finalityCutoff: bigint,
): Promise<{ count: number; points: number }> {
  const dayExpr = sql<string>`floor(${transactionSwap.blockTimestamp} / ${SECONDS_PER_DAY})`;

  // GROUP BY the SELECT ordinal (the day bucket is the first projected column)
  // rather than re-rendering `dayExpr`: Drizzle emits the column unqualified in
  // the projection but qualified in GROUP BY, and re-binds the divisor literal,
  // so the two expressions are not byte-identical and Postgres rejects the query
  // (SQLSTATE 42803). Ordinal grouping references the projection verbatim.
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
    .groupBy(sql`1`);

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
 * LP point breakdown for an address (historical credited days + live tail).
 */
export async function computeLpPoints(
  db: PointsDb,
  checksumWallet: string,
): Promise<PointsBreakdown["liquidity"]> {
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
    const dMin = (lastEventTimestamp + SPD - 1n) / SPD;
    const dMax = nowSec / SPD - 1n;
    if (dMax >= dMin) {
      liveDays = Number(dMax - dMin) + 1;
    }
  }

  if (liveDays > LIVE_TAIL_CAP_DAYS) liveDays = LIVE_TAIL_CAP_DAYS;

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
 * Two stacking one-time launchpad bonuses (created / graduated) on the Juicer
 * campaign chain.
 */
export async function computeMemeTokenBonus(
  db: PointsDb,
  checksumAddress: string,
): Promise<{
  memeTokenCreated: boolean;
  memeTokenPoints: number;
  memeTokenGraduated: boolean;
  memeTokenGraduatedPoints: number;
}> {
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
  const row: { created?: boolean; graduated?: boolean } = Array.isArray(rawResult)
    ? rawResult[0]
    : (rawResult?.rows?.[0] ?? {});

  const created = !!row.created;
  const graduated = !!row.graduated;
  return {
    memeTokenCreated: created,
    memeTokenPoints: created ? POINTS_PER_MEME_TOKEN_CREATED : 0,
    memeTokenGraduated: graduated,
    memeTokenGraduatedPoints: graduated ? POINTS_PER_MEME_TOKEN_GRADUATED : 0,
  };
}

/**
 * Daily-running balance metric for one of the hold streams (savings / juiceHold
 * / lending): SUM of historical day-credit minUnits + capped live tail.
 */
export async function computeDailyHoldStream(
  db: PointsDb,
  opts: {
    checksumAddress: string;
    walletTable: any;
    walletAddressField: any;
    walletBalanceField: any;
    walletLastTsField: any;
    dayCreditTable: any;
    dayCreditMinUnitsField: any;
    dayCreditWalletField: any;
    pointsPerWholeTokenPerDay: bigint;
    wholeTokensPerPoint?: bigint;
  },
): Promise<{ wholeTokens: number; points: number }> {
  const {
    checksumAddress,
    walletTable,
    walletAddressField,
    walletBalanceField,
    walletLastTsField,
    dayCreditTable,
    dayCreditMinUnitsField,
    dayCreditWalletField,
    pointsPerWholeTokenPerDay,
    wholeTokensPerPoint,
  } = opts;

  // 1) Historical: sum of minUnits across all credited days.
  const sumRow: any[] = await db
    .select({ s: sum(dayCreditMinUnitsField) })
    .from(dayCreditTable)
    .where(eq(dayCreditWalletField, checksumAddress));
  const historicalUnits = BigInt(sumRow[0]?.s ?? 0);

  // 2) Live tail: balance × completed-days since lastEventTimestamp.
  const walletRows: any[] = await db
    .select({ balance: walletBalanceField, lastEventTimestamp: walletLastTsField })
    .from(walletTable)
    .where(eq(walletAddressField, checksumAddress))
    .limit(1);

  const rawBalance = BigInt(walletRows[0]?.balance ?? 0);
  const lastEventTs = BigInt(walletRows[0]?.lastEventTimestamp ?? 0);
  const wholeBalance = rawBalance / ONE_TOKEN_18;

  const nowSec = BigInt(Math.floor(Date.now() / 1_000));
  const SPD = BigInt(SECONDS_PER_DAY);
  let liveDays = 0n;
  if (wholeBalance > 0n && lastEventTs > 0n) {
    const dMin = (lastEventTs + SPD - 1n) / SPD;
    const dMax = nowSec / SPD - 1n;
    if (dMax >= dMin) {
      liveDays = dMax - dMin + 1n;
      if (liveDays > BigInt(LIVE_TAIL_CAP_DAYS)) {
        liveDays = BigInt(LIVE_TAIL_CAP_DAYS);
      }
    }
  }
  const liveUnits = wholeBalance * liveDays;
  const totalUnits = historicalUnits + liveUnits;

  const divisor = wholeTokensPerPoint ?? 1n;
  const points = (totalUnits / divisor) * pointsPerWholeTokenPerDay;
  return {
    wholeTokens: Number(wholeBalance),
    points: Number(points),
  };
}

export async function computeSavingsBonus(
  db: PointsDb,
  checksumAddress: string,
): Promise<{ jusdSaved: number; points: number }> {
  const { wholeTokens, points } = await computeDailyHoldStream(db, {
    checksumAddress,
    walletTable: savingsWallet,
    walletAddressField: savingsWallet.walletAddress,
    walletBalanceField: savingsWallet.balance,
    walletLastTsField: savingsWallet.lastEventTimestamp,
    dayCreditTable: savingsDayCredit,
    dayCreditMinUnitsField: savingsDayCredit.minJusdUnits,
    dayCreditWalletField: savingsDayCredit.walletAddress,
    pointsPerWholeTokenPerDay: POINTS_PER_JUSD_SAVED_PER_DAY,
  });
  return { jusdSaved: wholeTokens, points };
}

export async function computeJuiceHoldBonus(
  db: PointsDb,
  checksumAddress: string,
): Promise<{ juiceHeld: number; points: number }> {
  const { wholeTokens, points } = await computeDailyHoldStream(db, {
    checksumAddress,
    walletTable: juiceHoldWallet,
    walletAddressField: juiceHoldWallet.walletAddress,
    walletBalanceField: juiceHoldWallet.balance,
    walletLastTsField: juiceHoldWallet.lastEventTimestamp,
    dayCreditTable: juiceHoldDayCredit,
    dayCreditMinUnitsField: juiceHoldDayCredit.minJuiceUnits,
    dayCreditWalletField: juiceHoldDayCredit.walletAddress,
    pointsPerWholeTokenPerDay: POINTS_PER_JUICE_PER_DAY,
    wholeTokensPerPoint: JUICE_PER_POINT,
  });
  return { juiceHeld: wholeTokens, points };
}

export async function computeLendingBonus(
  db: PointsDb,
  checksumAddress: string,
): Promise<{ usdLent: number; points: number }> {
  const { wholeTokens, points } = await computeDailyHoldStream(db, {
    checksumAddress,
    walletTable: lendingWallet,
    walletAddressField: lendingWallet.walletAddress,
    walletBalanceField: lendingWallet.totalPrincipalJusd,
    walletLastTsField: lendingWallet.lastEventTimestamp,
    dayCreditTable: lendingDayCredit,
    dayCreditMinUnitsField: lendingDayCredit.minJusdUnits,
    dayCreditWalletField: lendingDayCredit.walletAddress,
    pointsPerWholeTokenPerDay: POINTS_PER_USD_LENT_PER_DAY,
  });
  return { usdLent: wholeTokens, points };
}

export async function buildBreakdown(
  db: PointsDb,
  checksumAddress: string,
  finalityCutoff: bigint,
): Promise<PointsBreakdown> {
  const [swaps, liquidity, meme, savings, juiceHold, lending] = await Promise.all([
    computeSwapPoints(db, checksumAddress, finalityCutoff),
    computeLpPoints(db, checksumAddress),
    computeMemeTokenBonus(db, checksumAddress),
    computeSavingsBonus(db, checksumAddress),
    computeJuiceHoldBonus(db, checksumAddress),
    computeLendingBonus(db, checksumAddress),
  ]);
  const bonusesPoints =
    meme.memeTokenPoints +
    meme.memeTokenGraduatedPoints +
    savings.points +
    juiceHold.points +
    lending.points;
  return {
    total: swaps.points + liquidity.points + bonusesPoints,
    swaps,
    liquidity,
    bonuses: {
      ...meme,
      savings,
      juiceHold,
      lending,
      points: bonusesPoints,
    },
  };
}

/**
 * Top-N wallets by swap points. Raw CTE so aggregation stays in Postgres.
 * Rank uses ONLY swap points by design (LP-only wallets excluded).
 */
export async function computeLeaderboard(
  db: PointsDb,
  finalityCutoff: bigint,
): Promise<LeaderboardEntry[]> {
  const rawResult: any = await db.execute(sql`
    WITH daily_counts AS (
      SELECT
        ${transactionSwap.swapperAddress} AS addr,
        FLOOR(${transactionSwap.blockTimestamp} / ${SECONDS_PER_DAY}) AS day,
        COUNT(*)::int AS n
      FROM ${transactionSwap}
      WHERE ${transactionSwap.blockNumber} <= ${finalityCutoff}
      -- Group by the SELECT ordinals (addr, day): re-interpolating the column
      -- and divisor would re-bind the literal to a fresh placeholder, so the
      -- GROUP BY expression would not match the projection and Postgres would
      -- reject the query (SQLSTATE 42803).
      GROUP BY 1, 2
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

  const rows: Array<{ addr: string; points: number | string | bigint }> = Array.isArray(rawResult)
    ? rawResult
    : (rawResult?.rows ?? []);

  return rows.map((row, i) => ({
    rank: i + 1,
    address: String(row.addr).toLowerCase(),
    points: Number(row.points),
  }));
}

export const POINTS_CONFIG = {
  POINTS_PER_SWAP,
  POINTS_PER_LIQUIDITY_DAY,
  POINTS_PER_MEME_TOKEN_CREATED,
  POINTS_PER_MEME_TOKEN_GRADUATED,
  POINTS_PER_JUSD_SAVED_PER_DAY: 1,
  POINTS_PER_JUICE_PER_DAY: 1,
  JUICE_PER_POINT: 10,
  POINTS_PER_USD_LENT_PER_DAY: 5,
  MIN_LIQUIDITY_USD,
  MAX_SWAP_POINTS_PER_DAY,
  FINALITY_OFFSET_BLOCKS,
  LEADERBOARD_LIMIT,
  LIVE_TAIL_CAP_DAYS,
  JUICER_CAMPAIGN_CHAIN_ID,
};
