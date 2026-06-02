/**
 * Test database helper for the points-computation harness.
 *
 * Spins a node-postgres Drizzle handle over a local Postgres (the same engine
 * the indexer uses in production) so the real `pointsCompute.ts` queries run
 * against real SQL — FLOOR / LEAST / EXISTS / int8 casts and all. Tables are
 * created with the exact names/columns the Ponder schema produces.
 *
 * Connection comes from POINTS_TEST_DATABASE_URL (or the local default below).
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";
import * as schema from "../../ponder.schema";

const DEFAULT_URL = "postgresql://postgres@localhost:54329/ponder_test";

export function getPool(): Pool {
  const connectionString =
    process.env.POINTS_TEST_DATABASE_URL || DEFAULT_URL;
  return new Pool({ connectionString });
}

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

export function makeDb(pool: Pool): TestDb {
  return drizzle(pool, { schema });
}

/**
 * DDL mirroring the points-relevant Ponder tables. Column names are quoted to
 * preserve the camelCase the schema emits (e.g. "swapperAddress"). Non-queried
 * columns are nullable so fixtures can stay minimal; the queries only read the
 * columns asserted on below.
 */
const DDL = /* sql */ `
CREATE TABLE IF NOT EXISTS "transactionSwap" (
  "id" text PRIMARY KEY,
  "swapperAddress" text,
  "txHash" text,
  "chainId" integer,
  "blockNumber" numeric(78),
  "blockTimestamp" numeric(78),
  "from" text,
  "to" text,
  "tokenIn" text,
  "tokenOut" text,
  "amountIn" numeric(78),
  "amountOut" numeric(78)
);

CREATE TABLE IF NOT EXISTS "blockProgress" (
  "id" text PRIMARY KEY,
  "chainId" integer,
  "blockNumber" numeric(78),
  "blockTimestamp" numeric(78),
  "lastUpdatedAt" numeric(78)
);

CREATE TABLE IF NOT EXISTS "lp_position_wallet" (
  "id" text PRIMARY KEY,
  "chainId" integer,
  "walletAddress" text,
  "usdCents" numeric(78),
  "lastEventTimestamp" numeric(78)
);

CREATE TABLE IF NOT EXISTS "lp_day_credit" (
  "id" text PRIMARY KEY,
  "chainId" integer,
  "walletAddress" text,
  "day" numeric(78)
);

CREATE TABLE IF NOT EXISTS "juice_hold_wallet" (
  "id" text PRIMARY KEY,
  "chainId" integer,
  "walletAddress" text,
  "balance" numeric(78),
  "lastEventTimestamp" numeric(78)
);

CREATE TABLE IF NOT EXISTS "juice_hold_day_credit" (
  "id" text PRIMARY KEY,
  "chainId" integer,
  "walletAddress" text,
  "day" numeric(78),
  "minJuiceUnits" numeric(78)
);

CREATE TABLE IF NOT EXISTS "savings_wallet" (
  "id" text PRIMARY KEY,
  "chainId" integer,
  "walletAddress" text,
  "balance" numeric(78),
  "lastEventTimestamp" numeric(78)
);

CREATE TABLE IF NOT EXISTS "savings_day_credit" (
  "id" text PRIMARY KEY,
  "chainId" integer,
  "walletAddress" text,
  "day" numeric(78),
  "minJusdUnits" numeric(78)
);

CREATE TABLE IF NOT EXISTS "lending_wallet" (
  "id" text PRIMARY KEY,
  "chainId" integer,
  "walletAddress" text,
  "totalPrincipalJusd" numeric(78),
  "lastEventTimestamp" numeric(78)
);

CREATE TABLE IF NOT EXISTS "lending_day_credit" (
  "id" text PRIMARY KEY,
  "chainId" integer,
  "walletAddress" text,
  "day" numeric(78),
  "minJusdUnits" numeric(78)
);

CREATE TABLE IF NOT EXISTS "launchpadToken" (
  "id" text PRIMARY KEY,
  "address" text,
  "chainId" integer,
  "name" text,
  "symbol" text,
  "creator" text,
  "graduated" boolean DEFAULT false
);
`;

const POINTS_TABLES = [
  "transactionSwap",
  "blockProgress",
  "lp_position_wallet",
  "lp_day_credit",
  "juice_hold_wallet",
  "juice_hold_day_credit",
  "savings_wallet",
  "savings_day_credit",
  "lending_wallet",
  "lending_day_credit",
  "launchpadToken",
];

export async function createSchema(db: TestDb): Promise<void> {
  await db.execute(sql.raw(DDL));
}

export async function truncateAll(db: TestDb): Promise<void> {
  for (const t of POINTS_TABLES) {
    await db.execute(sql.raw(`TRUNCATE TABLE "${t}"`));
  }
}

/** Insert a finality anchor so latestFinalizedBlock() resolves. */
export async function seedBlockProgress(
  db: TestDb,
  blockNumber: bigint,
  chainId = 4114,
): Promise<void> {
  await db.execute(
    sql`INSERT INTO "blockProgress" ("id","chainId","blockNumber","blockTimestamp","lastUpdatedAt")
        VALUES ('progress', ${chainId}, ${blockNumber}, 0, 0)`,
  );
}
