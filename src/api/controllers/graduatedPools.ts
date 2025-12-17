/**
 * Graduated Pools API controller - endpoints for querying V2 pools from graduated launchpad tokens
 * Used by the router to find available V2 pools for routing
 */
import { eq, desc } from "drizzle-orm";
import { Context, Hono } from "hono";
import { getAddress } from "viem";
// @ts-ignore
import { db } from "ponder:api";
// @ts-ignore
import { graduatedV2Pool, launchpadToken } from "ponder:schema";

const graduatedPools = new Hono();

/**
 * GET /graduated-pools - List all graduated V2 pools
 * Returns pools with token metadata for routing purposes
 */
graduatedPools.get("/", async (c: Context) => {
  try {
    const pools = await db
      .select({
        pairAddress: graduatedV2Pool.pairAddress,
        token0: graduatedV2Pool.token0,
        token1: graduatedV2Pool.token1,
        reserve0: graduatedV2Pool.reserve0,
        reserve1: graduatedV2Pool.reserve1,
        launchpadTokenAddress: graduatedV2Pool.launchpadTokenAddress,
        createdAt: graduatedV2Pool.createdAt,
        totalSwaps: graduatedV2Pool.totalSwaps,
        // Join with launchpad token for metadata
        tokenName: launchpadToken.name,
        tokenSymbol: launchpadToken.symbol,
      })
      .from(graduatedV2Pool)
      .leftJoin(launchpadToken, eq(graduatedV2Pool.launchpadTokenAddress, launchpadToken.address))
      .orderBy(desc(graduatedV2Pool.createdAt));

    return c.json({ pools });
  } catch (error) {
    console.error("[GraduatedPools API] Error fetching pools:", error);
    return c.json({ error: "Failed to fetch graduated pools" }, 500);
  }
});

/**
 * GET /graduated-pools/:pairAddress - Single pool details
 */
graduatedPools.get("/:pairAddress", async (c: Context) => {
  try {
    const pairAddress = c.req.param("pairAddress");

    if (!pairAddress || !pairAddress.startsWith("0x")) {
      return c.json({ error: "Invalid address" }, 400);
    }

    const checksumAddress = getAddress(pairAddress);
    const pools = await db
      .select()
      .from(graduatedV2Pool)
      .where(eq(graduatedV2Pool.pairAddress, checksumAddress))
      .limit(1);

    if (pools.length === 0) {
      return c.json({ error: "Pool not found" }, 404);
    }

    return c.json({ pool: pools[0] });
  } catch (error) {
    console.error("[GraduatedPools API] Error fetching pool:", error);
    return c.json({ error: "Failed to fetch pool" }, 500);
  }
});

/**
 * GET /graduated-pools/by-token/:tokenAddress - Find V2 pool by launchpad token address
 */
graduatedPools.get("/by-token/:tokenAddress", async (c: Context) => {
  try {
    const tokenAddress = c.req.param("tokenAddress");

    if (!tokenAddress || !tokenAddress.startsWith("0x")) {
      return c.json({ error: "Invalid address" }, 400);
    }

    const checksumAddress = getAddress(tokenAddress);
    const pools = await db
      .select()
      .from(graduatedV2Pool)
      .where(eq(graduatedV2Pool.launchpadTokenAddress, checksumAddress))
      .limit(1);

    if (pools.length === 0) {
      return c.json({ error: "No V2 pool found for this token" }, 404);
    }

    return c.json({ pool: pools[0] });
  } catch (error) {
    console.error("[GraduatedPools API] Error fetching pool by token:", error);
    return c.json({ error: "Failed to fetch pool" }, 500);
  }
});

export default graduatedPools;
