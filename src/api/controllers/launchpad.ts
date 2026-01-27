/**
 * Launchpad API controller - endpoints for querying launchpad tokens and trades
 */
import { eq, desc, and, sql, count, replaceBigInts, or, gte, lt } from "ponder";
import { Context, Hono } from "hono";
import { getAddress } from "viem";
// @ts-ignore
import { db } from "ponder:api";
// @ts-ignore
import { launchpadToken, launchpadTrade } from "ponder:schema";

const launchpad = new Hono();

// Progress threshold in basis points (0-10000) for "graduating" status
// 80% = 8000 basis points
const GRADUATING_THRESHOLD = 8000;

/**
 * GET /launchpad/tokens - List all tokens with filtering
 * Query params:
 *   - filter: "all" | "active" | "graduating" | "graduated" (default: "all")
 *   - page: number (default: 0)
 *   - limit: number (default: 20, max: 100)
 *   - sort: "newest" | "volume" | "trades" (default: "newest")
 *   - chainId: number (optional - filter by chain)
 */
launchpad.get("/tokens", async (c: Context) => {
  try {
    const filter = c.req.query("filter") || "all";
    const page = Math.max(0, parseInt(c.req.query("page") || "0"));
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query("limit") || "20")));
    const sort = c.req.query("sort") || "newest";
    const chainIdParam = c.req.query("chainId");
    const chainId = chainIdParam ? parseInt(chainIdParam) : undefined;
    const offset = page * limit;

    // Build where conditions array
    const conditions = [];

    // Add chainId filter if provided
    if (chainId !== undefined && !isNaN(chainId)) {
      conditions.push(eq(launchpadToken.chainId, chainId));
    }

    // Add status filter
    switch (filter) {
      case "active":
        // Active = not graduated AND progress < 80%
        conditions.push(eq(launchpadToken.graduated, false));
        conditions.push(lt(launchpadToken.progress, GRADUATING_THRESHOLD));
        break;
      case "graduating":
        // Graduating = not graduated AND (progress >= 80% OR canGraduate is true)
        conditions.push(eq(launchpadToken.graduated, false));
        conditions.push(
          or(
            gte(launchpadToken.progress, GRADUATING_THRESHOLD),
            eq(launchpadToken.canGraduate, true)
          )
        );
        break;
      case "graduated":
        conditions.push(eq(launchpadToken.graduated, true));
        break;
      // "all" - no additional filter
    }

    // Combine all conditions
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Build order by based on sort
    let orderBy;
    switch (sort) {
      case "volume":
        orderBy = desc(launchpadToken.totalVolumeBase);
        break;
      case "trades":
        orderBy = desc(sql`${launchpadToken.totalBuys} + ${launchpadToken.totalSells}`);
        break;
      default: // "newest"
        orderBy = desc(launchpadToken.createdAt);
    }

    // Execute query
    const tokens = await db
      .select()
      .from(launchpadToken)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const totalResult = await db
      .select({ count: count() })
      .from(launchpadToken)
      .where(whereClause);

    const total = totalResult[0]?.count || 0;

    return c.json(replaceBigInts({
      tokens,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }, (v) => String(v)));
  } catch (error) {
    console.error("[Launchpad API] Error fetching tokens:", error);
    return c.json({ error: "Failed to fetch tokens" }, 500);
  }
});

/**
 * GET /launchpad/token/:address - Single token details
 */
launchpad.get("/token/:address", async (c: Context) => {
  try {
    const address = c.req.param("address");

    if (!address || !address.startsWith("0x")) {
      return c.json({ error: "Invalid address" }, 400);
    }

    const checksumAddress = getAddress(address);
    const tokens = await db
      .select()
      .from(launchpadToken)
      .where(eq(launchpadToken.address, checksumAddress))
      .limit(1);

    if (tokens.length === 0) {
      return c.json({ error: "Token not found" }, 404);
    }

    return c.json(replaceBigInts({ token: tokens[0] }, (v) => String(v)));
  } catch (error) {
    console.error("[Launchpad API] Error fetching token:", error);
    return c.json({ error: "Failed to fetch token" }, 500);
  }
});

/**
 * GET /launchpad/token/:address/trades - Token trade history
 * Query params:
 *   - limit: number (default: 50, max: 100)
 *   - page: number (default: 0)
 */
launchpad.get("/token/:address/trades", async (c: Context) => {
  try {
    const address = c.req.param("address");
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query("limit") || "50")));
    const page = Math.max(0, parseInt(c.req.query("page") || "0"));
    const offset = page * limit;

    if (!address || !address.startsWith("0x")) {
      return c.json({ error: "Invalid address" }, 400);
    }

    const checksumAddress = getAddress(address);
    const trades = await db
      .select()
      .from(launchpadTrade)
      .where(eq(launchpadTrade.tokenAddress, checksumAddress))
      .orderBy(desc(launchpadTrade.timestamp))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const totalResult = await db
      .select({ count: count() })
      .from(launchpadTrade)
      .where(eq(launchpadTrade.tokenAddress, checksumAddress));

    const total = totalResult[0]?.count || 0;

    return c.json(replaceBigInts({
      trades,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }, (v) => String(v)));
  } catch (error) {
    console.error("[Launchpad API] Error fetching trades:", error);
    return c.json({ error: "Failed to fetch trades" }, 500);
  }
});

/**
 * GET /launchpad/stats - Overall launchpad statistics
 * Query params:
 *   - chainId: number (optional - filter by chain)
 */
launchpad.get("/stats", async (c: Context) => {
  try {
    const chainIdParam = c.req.query("chainId");
    const chainId = chainIdParam ? parseInt(chainIdParam) : undefined;

    // Build base chain filter condition
    const chainFilter = chainId !== undefined && !isNaN(chainId)
      ? eq(launchpadToken.chainId, chainId)
      : undefined;
    const tradeChainFilter = chainId !== undefined && !isNaN(chainId)
      ? eq(launchpadTrade.chainId, chainId)
      : undefined;

    const totalTokensResult = await db
      .select({ count: count() })
      .from(launchpadToken)
      .where(chainFilter);

    const graduatedTokensResult = await db
      .select({ count: count() })
      .from(launchpadToken)
      .where(chainFilter
        ? and(chainFilter, eq(launchpadToken.graduated, true))
        : eq(launchpadToken.graduated, true)
      );

    // Active = not graduated AND progress < 80%
    const activeConditions = [
      eq(launchpadToken.graduated, false),
      lt(launchpadToken.progress, GRADUATING_THRESHOLD),
    ];
    if (chainFilter) activeConditions.unshift(chainFilter);
    const activeTokensResult = await db
      .select({ count: count() })
      .from(launchpadToken)
      .where(and(...activeConditions));

    // Graduating = not graduated AND (progress >= 80% OR canGraduate is true)
    const graduatingConditions = [
      eq(launchpadToken.graduated, false),
      or(
        gte(launchpadToken.progress, GRADUATING_THRESHOLD),
        eq(launchpadToken.canGraduate, true)
      ),
    ];
    if (chainFilter) graduatingConditions.unshift(chainFilter);
    const graduatingTokensResult = await db
      .select({ count: count() })
      .from(launchpadToken)
      .where(and(...graduatingConditions));

    const totalTradesResult = await db
      .select({ count: count() })
      .from(launchpadTrade)
      .where(tradeChainFilter);

    const totalVolumeResult = await db
      .select({ volume: sql<string>`COALESCE(SUM(${launchpadToken.totalVolumeBase}), 0)::text` })
      .from(launchpadToken)
      .where(chainFilter);

    return c.json({
      totalTokens: totalTokensResult[0]?.count || 0,
      graduatedTokens: graduatedTokensResult[0]?.count || 0,
      activeTokens: activeTokensResult[0]?.count || 0,
      graduatingTokens: graduatingTokensResult[0]?.count || 0,
      totalTrades: totalTradesResult[0]?.count || 0,
      totalVolumeBase: totalVolumeResult[0]?.volume || "0",
    });
  } catch (error) {
    console.error("[Launchpad API] Error fetching stats:", error);
    return c.json({ error: "Failed to fetch stats" }, 500);
  }
});

/**
 * GET /launchpad/recent-trades - Recent trades across all tokens
 * Query params:
 *   - limit: number (default: 20, max: 50)
 *   - chainId: number (optional - filter by chain)
 */
launchpad.get("/recent-trades", async (c: Context) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(c.req.query("limit") || "20")));
    const chainIdParam = c.req.query("chainId");
    const chainId = chainIdParam ? parseInt(chainIdParam) : undefined;

    // Build chain filter condition
    const chainFilter = chainId !== undefined && !isNaN(chainId)
      ? eq(launchpadTrade.chainId, chainId)
      : undefined;

    const trades = await db
      .select({
        id: launchpadTrade.id,
        tokenAddress: launchpadTrade.tokenAddress,
        trader: launchpadTrade.trader,
        isBuy: launchpadTrade.isBuy,
        baseAmount: launchpadTrade.baseAmount,
        tokenAmount: launchpadTrade.tokenAmount,
        timestamp: launchpadTrade.timestamp,
        txHash: launchpadTrade.txHash,
        tokenName: launchpadToken.name,
        tokenSymbol: launchpadToken.symbol,
      })
      .from(launchpadTrade)
      .leftJoin(launchpadToken, eq(launchpadTrade.tokenAddress, launchpadToken.address))
      .where(chainFilter)
      .orderBy(desc(launchpadTrade.timestamp))
      .limit(limit);

    return c.json(replaceBigInts({ trades }, (v) => String(v)));
  } catch (error) {
    console.error("[Launchpad API] Error fetching recent trades:", error);
    return c.json({ error: "Failed to fetch recent trades" }, 500);
  }
});

export default launchpad;
