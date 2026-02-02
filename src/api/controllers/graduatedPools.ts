/**
 * Graduated Pools API controller - endpoints for querying V2 pools from graduated launchpad tokens
 * Used by the router to find available V2 pools for routing
 */
import { eq, desc, replaceBigInts } from "ponder";
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
 * Note: Reserves are returned as "0" - the API layer fetches fresh on-chain reserves
 * Query params:
 *   - chainId: Filter pools by chain ID (optional)
 */
graduatedPools.get("/", async (c: Context) => {
  try {
    const chainIdParam = c.req.query("chainId");
    const chainId = chainIdParam ? parseInt(chainIdParam, 10) : undefined;

    // Build query with optional chainId filter
    const baseQuery = db
      .select({
        pairAddress: graduatedV2Pool.pairAddress,
        chainId: graduatedV2Pool.chainId,
        token0: graduatedV2Pool.token0,
        token1: graduatedV2Pool.token1,
        launchpadTokenAddress: graduatedV2Pool.launchpadTokenAddress,
        createdAt: graduatedV2Pool.createdAt,
        totalSwaps: graduatedV2Pool.totalSwaps,
        // Join with launchpad token for metadata
        tokenName: launchpadToken.name,
        tokenSymbol: launchpadToken.symbol,
      })
      .from(graduatedV2Pool)
      .leftJoin(launchpadToken, eq(graduatedV2Pool.launchpadTokenAddress, launchpadToken.address));

    // Apply chainId filter if provided
    const pools = chainId !== undefined && !isNaN(chainId)
      ? await baseQuery
          .where(eq(graduatedV2Pool.chainId, chainId))
          .orderBy(desc(graduatedV2Pool.createdAt))
      : await baseQuery.orderBy(desc(graduatedV2Pool.createdAt));

    // Add zero reserves - API layer will fetch fresh on-chain data if needed
    const poolsWithReserves = pools.map((pool: any) => ({
      ...pool,
      reserve0: "0",
      reserve1: "0",
    }));

    return c.json(replaceBigInts({ pools: poolsWithReserves }, (v) => String(v)));
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

    // Add zero reserves - API layer will fetch fresh on-chain data if needed
    const poolWithReserves = { ...pools[0], reserve0: "0", reserve1: "0" };

    return c.json(replaceBigInts({ pool: poolWithReserves }, (v) => String(v)));
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

    // Add zero reserves - API layer will fetch fresh on-chain data if needed
    const poolWithReserves = { ...pools[0], reserve0: "0", reserve1: "0" };

    return c.json(replaceBigInts({ pool: poolWithReserves }, (v) => String(v)));
  } catch (error) {
    console.error("[GraduatedPools API] Error fetching pool by token:", error);
    return c.json({ error: "Failed to fetch pool" }, 500);
  }
});

export default graduatedPools;
