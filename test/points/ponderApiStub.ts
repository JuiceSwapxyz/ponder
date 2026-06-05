/**
 * Test stand-in for the `ponder:api` virtual module. Vitest aliases
 * `ponder:api` to this file so the real `points.ts` controller can be imported
 * and exercised over HTTP without the Ponder runtime. The `db` here is a
 * node-postgres Drizzle handle over the same fixture database the harness seeds.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../../ponder.schema";

const connectionString =
  process.env.POINTS_TEST_DATABASE_URL ||
  "postgresql://postgres@localhost:54329/ponder_test";

const pool = new Pool({ connectionString });

export const db = drizzle(pool, { schema });
