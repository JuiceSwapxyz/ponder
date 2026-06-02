/**
 * Points-tracking harness — exercises the REAL `pointsCompute.ts` queries
 * against a real local Postgres with deterministic fixtures.
 *
 * These are behaviour tests: they assert the JP a wallet earns given a known
 * on-chain state, covering the swap daily-cap, LP day accrual + live tail, the
 * three daily hold streams, the one-time launchpad bonuses, the leaderboard
 * ranking SQL, and the finality cutoff. `Date.now()` is pinned so the live-tail
 * forecast is deterministic.
 */

import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildBreakdown,
  computeJuiceHoldBonus,
  computeLeaderboard,
  computeLendingBonus,
  computeLpPoints,
  computeMemeTokenBonus,
  computeSavingsBonus,
  computeSwapPoints,
  FinalityUnknownError,
  latestFinalizedBlock,
  SECONDS_PER_DAY,
} from "../../src/api/controllers/pointsCompute";
import { createSchema, getPool, makeDb, seedBlockProgress, truncateAll, type TestDb } from "./db";

const CHAIN = 4114; // Juicer campaign chain
const WALLET = "0x1111111111111111111111111111111111111111";
const WALLET2 = "0x2222222222222222222222222222222222222222";
const ONE_TOKEN = 10n ** 18n;

// Pin "now" to a UTC midnight so day math is exact.
const FIXED_NOW_MS = Date.UTC(2026, 5, 2, 0, 0, 0); // 2026-06-02T00:00:00Z
const NOW_SEC = Math.floor(FIXED_NOW_MS / 1000);
const DAY_NOW = Math.floor(NOW_SEC / SECONDS_PER_DAY); // today's day index
// A last-event timestamp 3 whole days ago -> exactly 3 fully-covered live days.
const LAST_TS_3D_AGO = (DAY_NOW - 3) * SECONDS_PER_DAY;
const EXPECTED_LIVE_DAYS = 3;

let pool: ReturnType<typeof getPool>;
let db: TestDb;

beforeAll(async () => {
  pool = getPool();
  db = makeDb(pool);
  await createSchema(db);
});

afterAll(async () => {
  await pool.end();
});

beforeEach(async () => {
  await truncateAll(db);
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW_MS);
});

afterEach(() => {
  vi.useRealTimers();
});

async function insertSwap(opts: {
  id: string;
  wallet: string;
  blockNumber: number;
  day: number;
}) {
  const ts = opts.day * SECONDS_PER_DAY + 100; // mid-day
  await db.execute(sql`
    INSERT INTO "transactionSwap"
      ("id","swapperAddress","txHash","chainId","blockNumber","blockTimestamp","from","to","tokenIn","tokenOut","amountIn","amountOut")
    VALUES (${opts.id}, ${opts.wallet}, ${"0x"}, ${CHAIN}, ${opts.blockNumber}, ${ts}, ${"0x"}, ${"0x"}, ${"0x"}, ${"0x"}, 0, 0)
  `);
}

describe("latestFinalizedBlock", () => {
  it("subtracts the finality offset", async () => {
    await seedBlockProgress(db, 1000n, CHAIN);
    expect(await latestFinalizedBlock(db)).toBe(1000n - 32n);
  });

  it("throws FinalityUnknownError when blockProgress is empty", async () => {
    await expect(latestFinalizedBlock(db)).rejects.toBeInstanceOf(FinalityUnknownError);
  });

  it("clamps to 0 when head is below the offset", async () => {
    await seedBlockProgress(db, 10n, CHAIN);
    expect(await latestFinalizedBlock(db)).toBe(0n);
  });
});

describe("computeSwapPoints", () => {
  it("applies the per-day cap and excludes swaps past the finality cutoff", async () => {
    const cutoff = 968n; // = 1000 - 32
    // Day A: 15 swaps -> capped at 1000 (not 1500).
    for (let i = 0; i < 15; i++) {
      await insertSwap({ id: `a${i}`, wallet: WALLET, blockNumber: 100, day: DAY_NOW - 5 });
    }
    // Day B: 3 swaps -> 300.
    for (let i = 0; i < 3; i++) {
      await insertSwap({ id: `b${i}`, wallet: WALLET, blockNumber: 200, day: DAY_NOW - 4 });
    }
    // One swap beyond the finality cutoff -> ignored.
    await insertSwap({ id: "future", wallet: WALLET, blockNumber: 999, day: DAY_NOW - 3 });

    const res = await computeSwapPoints(db, WALLET, cutoff);
    expect(res.count).toBe(18); // 15 + 3, the future swap excluded
    expect(res.points).toBe(1300); // 1000 (capped) + 300
  });
});

describe("computeLpPoints", () => {
  it("adds historical credited days and the live tail above the $10 floor", async () => {
    // 2 historical credited days.
    for (const day of [DAY_NOW - 10, DAY_NOW - 9]) {
      await db.execute(sql`
        INSERT INTO "lp_day_credit" ("id","chainId","walletAddress","day")
        VALUES (${`${CHAIN}:${WALLET}:${day}`}, ${CHAIN}, ${WALLET}, ${day})
      `);
    }
    // Running value $15 (>= $10), last event 3 days ago -> 3 live days.
    await db.execute(sql`
      INSERT INTO "lp_position_wallet" ("id","chainId","walletAddress","usdCents","lastEventTimestamp")
      VALUES (${`${CHAIN}:${WALLET}`}, ${CHAIN}, ${WALLET}, 1500, ${LAST_TS_3D_AGO})
    `);

    const res = await computeLpPoints(db, WALLET);
    expect(res.days).toBe(2 + EXPECTED_LIVE_DAYS);
    expect(res.points).toBe((2 + EXPECTED_LIVE_DAYS) * 50);
    expect(res.currentUsdValue).toBe(15);
    expect(res.meetsMinimum).toBe(true);
  });

  it("yields no live tail below the $10 floor", async () => {
    await db.execute(sql`
      INSERT INTO "lp_position_wallet" ("id","chainId","walletAddress","usdCents","lastEventTimestamp")
      VALUES (${`${CHAIN}:${WALLET}`}, ${CHAIN}, ${WALLET}, 999, ${LAST_TS_3D_AGO})
    `);
    const res = await computeLpPoints(db, WALLET);
    expect(res.days).toBe(0);
    expect(res.points).toBe(0);
    expect(res.meetsMinimum).toBe(false);
  });
});

describe("daily hold streams", () => {
  it("savings: historical sum + live tail at 1 JP / JUSD / day", async () => {
    // balance 100 JUSD, last event 3 days ago.
    await db.execute(sql`
      INSERT INTO "savings_wallet" ("id","chainId","walletAddress","balance","lastEventTimestamp")
      VALUES (${`${CHAIN}:${WALLET}`}, ${CHAIN}, ${WALLET}, ${100n * ONE_TOKEN}, ${LAST_TS_3D_AGO})
    `);
    // historical credited days: 100 + 100 = 200 JUSD-days.
    for (const [i, day] of [DAY_NOW - 6, DAY_NOW - 5].entries()) {
      await db.execute(sql`
        INSERT INTO "savings_day_credit" ("id","chainId","walletAddress","day","minJusdUnits")
        VALUES (${`s${i}`}, ${CHAIN}, ${WALLET}, ${day}, 100)
      `);
    }
    const res = await computeSavingsBonus(db, WALLET);
    // live = 100 * 3 = 300; total = 500; points = 500 * 1.
    expect(res.jusdSaved).toBe(100);
    expect(res.points).toBe(500);
  });

  it("juiceHold: 1 JP per 10 JUICE per day (integer division)", async () => {
    // balance 55 JUICE, last event 3 days ago.
    await db.execute(sql`
      INSERT INTO "juice_hold_wallet" ("id","chainId","walletAddress","balance","lastEventTimestamp")
      VALUES (${`${CHAIN}:${WALLET}`}, ${CHAIN}, ${WALLET}, ${55n * ONE_TOKEN}, ${LAST_TS_3D_AGO})
    `);
    // historical: one day with 30 whole JUICE.
    await db.execute(sql`
      INSERT INTO "juice_hold_day_credit" ("id","chainId","walletAddress","day","minJuiceUnits")
      VALUES (${"j0"}, ${CHAIN}, ${WALLET}, ${DAY_NOW - 6}, 30)
    `);
    const res = await computeJuiceHoldBonus(db, WALLET);
    // live = 55 * 3 = 165; total = 195; points = floor(195 / 10) * 1 = 19.
    expect(res.juiceHeld).toBe(55);
    expect(res.points).toBe(19);
  });

  it("lending: 5 JP per $1 per day", async () => {
    await db.execute(sql`
      INSERT INTO "lending_wallet" ("id","chainId","walletAddress","totalPrincipalJusd","lastEventTimestamp")
      VALUES (${`${CHAIN}:${WALLET}`}, ${CHAIN}, ${WALLET}, ${20n * ONE_TOKEN}, ${LAST_TS_3D_AGO})
    `);
    const res = await computeLendingBonus(db, WALLET);
    // live = 20 * 3 = 60; historical 0; points = 60 * 5 = 300.
    expect(res.usdLent).toBe(20);
    expect(res.points).toBe(300);
  });
});

describe("computeMemeTokenBonus", () => {
  it("awards created + graduated one-time bonuses on the campaign chain", async () => {
    await db.execute(sql`
      INSERT INTO "launchpadToken" ("id","address","chainId","name","symbol","creator","graduated")
      VALUES (${"t1"}, ${"0xaaa"}, ${CHAIN}, ${"Meme"}, ${"MEME"}, ${WALLET}, true)
    `);
    const res = await computeMemeTokenBonus(db, WALLET);
    expect(res.memeTokenCreated).toBe(true);
    expect(res.memeTokenPoints).toBe(500);
    expect(res.memeTokenGraduated).toBe(true);
    expect(res.memeTokenGraduatedPoints).toBe(10_000);
  });

  it("ignores tokens created on other chains", async () => {
    await db.execute(sql`
      INSERT INTO "launchpadToken" ("id","address","chainId","name","symbol","creator","graduated")
      VALUES (${"t2"}, ${"0xbbb"}, ${1}, ${"Other"}, ${"OTH"}, ${WALLET}, true)
    `);
    const res = await computeMemeTokenBonus(db, WALLET);
    expect(res.memeTokenCreated).toBe(false);
    expect(res.memeTokenPoints).toBe(0);
    expect(res.memeTokenGraduated).toBe(false);
  });
});

describe("computeLeaderboard", () => {
  it("ranks wallets by capped swap points, lowercases, and drops zero-point wallets", async () => {
    const cutoff = 968n;
    // Wallet 1: 15 swaps day A (capped 1000) + 3 day B (300) = 1300.
    for (let i = 0; i < 15; i++) {
      await insertSwap({ id: `w1a${i}`, wallet: WALLET, blockNumber: 100, day: DAY_NOW - 5 });
    }
    for (let i = 0; i < 3; i++) {
      await insertSwap({ id: `w1b${i}`, wallet: WALLET, blockNumber: 200, day: DAY_NOW - 4 });
    }
    // Wallet 2: 2 swaps = 200.
    for (let i = 0; i < 2; i++) {
      await insertSwap({ id: `w2a${i}`, wallet: WALLET2, blockNumber: 100, day: DAY_NOW - 5 });
    }
    // Wallet 3: only a beyond-finality swap -> excluded entirely.
    await insertSwap({ id: "w3", wallet: "0x3333333333333333333333333333333333333333", blockNumber: 999, day: DAY_NOW - 4 });

    const entries = await computeLeaderboard(db, cutoff);
    expect(entries).toEqual([
      { rank: 1, address: WALLET.toLowerCase(), points: 1300 },
      { rank: 2, address: WALLET2.toLowerCase(), points: 200 },
    ]);
  });
});

describe("buildBreakdown", () => {
  it("sums every category into the grand total", async () => {
    const cutoff = 968n;
    // swaps: 3 -> 300
    for (let i = 0; i < 3; i++) {
      await insertSwap({ id: `s${i}`, wallet: WALLET, blockNumber: 100, day: DAY_NOW - 5 });
    }
    // lp: 1 historical day + 3 live = 4 days * 50 = 200
    await db.execute(sql`
      INSERT INTO "lp_day_credit" ("id","chainId","walletAddress","day")
      VALUES (${"lp0"}, ${CHAIN}, ${WALLET}, ${DAY_NOW - 9})
    `);
    await db.execute(sql`
      INSERT INTO "lp_position_wallet" ("id","chainId","walletAddress","usdCents","lastEventTimestamp")
      VALUES (${`${CHAIN}:${WALLET}`}, ${CHAIN}, ${WALLET}, 1500, ${LAST_TS_3D_AGO})
    `);
    // meme created+graduated = 10500
    await db.execute(sql`
      INSERT INTO "launchpadToken" ("id","address","chainId","name","symbol","creator","graduated")
      VALUES (${"t1"}, ${"0xaaa"}, ${CHAIN}, ${"Meme"}, ${"MEME"}, ${WALLET}, true)
    `);

    const res = await buildBreakdown(db, WALLET, cutoff);
    expect(res.swaps.points).toBe(300);
    expect(res.liquidity.points).toBe(200);
    expect(res.bonuses.points).toBe(10_500);
    expect(res.total).toBe(300 + 200 + 10_500);
  });
});
