/**
 * V2 Pool Stats API controller - endpoints for querying V2 swap volume data
 * Used by the protocol stats endpoint to calculate V2 volume
 */
import { eq, and, desc, replaceBigInts } from "ponder";
import { Context, Hono } from "hono";
// @ts-ignore
import { db } from "ponder:api";
// @ts-ignore
import { v2PoolStat } from "ponder:schema";

const v2PoolStats = new Hono();

/**
 * GET /v2-pool-stats - Get aggregated V2 pool volume stats
 * Query params:
 *   - chainId: Filter by chain ID (required)
 *   - type: Temporal frame - "1h", "24h", or "all-time" (default: "24h")
 */
v2PoolStats.get("/", async (c: Context) => {
  try {
    const chainIdParam = c.req.query("chainId");
    if (!chainIdParam) {
      return c.json({ error: "chainId is required" }, 400);
    }

    const chainId = parseInt(chainIdParam, 10);
    if (isNaN(chainId)) {
      return c.json({ error: "Invalid chainId" }, 400);
    }

    const type = c.req.query("type") || "24h";
    if (!["1h", "24h", "all-time"].includes(type)) {
      return c.json({ error: "Invalid type. Must be '1h', '24h', or 'all-time'" }, 400);
    }

    const stats = await db
      .select()
      .from(v2PoolStat)
      .where(and(eq(v2PoolStat.chainId, chainId), eq(v2PoolStat.type, type)))
      .orderBy(desc(v2PoolStat.txCount))
      .limit(100);

    return c.json(replaceBigInts({ stats }, (v) => String(v)));
  } catch (error) {
    console.error("[V2PoolStats API] Error fetching stats:", error);
    return c.json({ error: "Failed to fetch V2 pool stats" }, 500);
  }
});

export default v2PoolStats;
