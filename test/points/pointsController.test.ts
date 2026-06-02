/**
 * Controller-level (HTTP) harness for the points endpoints.
 *
 * Drives the REAL `points.ts` Hono router end-to-end against the seeded fixture
 * Postgres (via the `ponder:api` alias stub). This is the exact path that
 * returns 500 on dev: a regression here proves the GROUP BY fix resolves the
 * production failure, not just the extracted helpers.
 */

import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import pointsRouter from "../../src/api/controllers/points";
import { createSchema, getPool, makeDb, seedBlockProgress, truncateAll, type TestDb } from "./db";

const CHAIN = 4114;
const WALLET = "0x1111111111111111111111111111111111111111";

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
});

async function insertSwap(id: string, wallet: string, blockNumber: number, day: number) {
  const ts = day * 86_400 + 100;
  await db.execute(sql`
    INSERT INTO "transactionSwap"
      ("id","swapperAddress","txHash","chainId","blockNumber","blockTimestamp","from","to","tokenIn","tokenOut","amountIn","amountOut")
    VALUES (${id}, ${wallet}, ${"0x"}, ${CHAIN}, ${blockNumber}, ${ts}, ${"0x"}, ${"0x"}, ${"0x"}, ${"0x"}, 0, 0)
  `);
}

describe("GET /points/:address", () => {
  it("returns 200 with a points breakdown (no longer 500)", async () => {
    await seedBlockProgress(db, 1000n, CHAIN);
    for (let i = 0; i < 3; i++) {
      await insertSwap(`s${i}`, WALLET, 100, 20000);
    }
    const res = await pointsRouter.request(`/${WALLET}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.swaps.count).toBe(3);
    expect(body.swaps.points).toBe(300);
    expect(body.total).toBe(300);
  });

  it("returns 400 for an invalid address", async () => {
    await seedBlockProgress(db, 1000n, CHAIN);
    const res = await pointsRouter.request("/not-an-address");
    expect(res.status).toBe(400);
  });

  it("returns 503 when the indexer block progress is unknown", async () => {
    // No blockProgress row -> finality unknown -> fail closed. Use a distinct,
    // never-queried address so the controller's per-address cache cannot serve
    // a stale 200 from an earlier case.
    const fresh = "0x9999999999999999999999999999999999999999";
    const res = await pointsRouter.request(`/${fresh}`);
    expect(res.status).toBe(503);
  });
});

describe("GET /points/leaderboard", () => {
  it("returns 200 with ranked entries (no longer 500)", async () => {
    await seedBlockProgress(db, 1000n, CHAIN);
    for (let i = 0; i < 5; i++) {
      await insertSwap(`l${i}`, WALLET, 100, 20000);
    }
    const res = await pointsRouter.request("/leaderboard");
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.entries[0]).toEqual({ rank: 1, address: WALLET.toLowerCase(), points: 500 });
  });
});
