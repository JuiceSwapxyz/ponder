/**
 * Launchpad API controller - endpoints for querying launchpad tokens and trades
 */
import { eq, desc, and, sql } from "drizzle-orm";
import { Context, Hono } from "hono";
import { getAddress } from "viem";
// @ts-ignore
import { db } from "ponder:api";
// @ts-ignore
import { launchpadToken, launchpadTrade } from "ponder:schema";

const launchpad = new Hono();

/**
 * GET /launchpad/tokens - List all tokens with filtering
 * Query params:
 *   - filter: "all" | "active" | "graduating" | "graduated" (default: "all")
 *   - page: number (default: 0)
 *   - limit: number (default: 20, max: 100)
 *   - sort: "newest" | "volume" | "trades" (default: "newest")
 */
launchpad.get("/tokens", async (c: Context) => {
  try {
    const filter = c.req.query("filter") || "all";
    const page = Math.max(0, parseInt(c.req.query("page") || "0"));
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query("limit") || "20")));
    const sort = c.req.query("sort") || "newest";
    const offset = page * limit;

    // Build where clause based on filter
    let whereClause;
    switch (filter) {
      case "active":
        whereClause = and(
          eq(launchpadToken.graduated, false),
          eq(launchpadToken.canGraduate, false)
        );
        break;
      case "graduating":
        whereClause = and(
          eq(launchpadToken.graduated, false),
          eq(launchpadToken.canGraduate, true)
        );
        break;
      case "graduated":
        whereClause = eq(launchpadToken.graduated, true);
        break;
      default: // "all"
        whereClause = undefined;
    }

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
      .select({ count: sql<number>`count(*)::int` })
      .from(launchpadToken)
      .where(whereClause);

    const total = totalResult[0]?.count || 0;

    return c.json({
      tokens,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
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

    return c.json({ token: tokens[0] });
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

    return c.json({ trades });
  } catch (error) {
    console.error("[Launchpad API] Error fetching trades:", error);
    return c.json({ error: "Failed to fetch trades" }, 500);
  }
});

/**
 * GET /launchpad/stats - Overall launchpad statistics
 */
launchpad.get("/stats", async (c: Context) => {
  try {
    const totalTokensResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(launchpadToken);

    const graduatedTokensResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(launchpadToken)
      .where(eq(launchpadToken.graduated, true));

    const activeTokensResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(launchpadToken)
      .where(and(
        eq(launchpadToken.graduated, false),
        eq(launchpadToken.canGraduate, false)
      ));

    const graduatingTokensResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(launchpadToken)
      .where(and(
        eq(launchpadToken.graduated, false),
        eq(launchpadToken.canGraduate, true)
      ));

    const totalTradesResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(launchpadTrade);

    const totalVolumeResult = await db
      .select({ volume: sql<string>`COALESCE(SUM(${launchpadToken.totalVolumeBase}), 0)::text` })
      .from(launchpadToken);

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
 */
launchpad.get("/recent-trades", async (c: Context) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(c.req.query("limit") || "20")));

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
      .orderBy(desc(launchpadTrade.timestamp))
      .limit(limit);

    return c.json({ trades });
  } catch (error) {
    console.error("[Launchpad API] Error fetching recent trades:", error);
    return c.json({ error: "Failed to fetch recent trades" }, 500);
  }
});

export default launchpad;
