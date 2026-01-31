/**
 * Activity API controller - endpoints for querying user activity (swaps and launchpad trades)
 */
import { eq, desc, and, count, replaceBigInts, inArray } from "ponder";
import { Context, Hono } from "hono";
import { getAddress, isAddress } from "viem";
// @ts-ignore
import { db } from "ponder:api";
// @ts-ignore
import { transactionSwap, launchpadTrade, token, launchpadToken } from "ponder:schema";

const activity = new Hono();

/**
 * GET /activity/swaps - Get user swap activity (DEX swaps + launchpad trades)
 * Query params:
 *   - address: wallet address (required)
 *   - chainId: number (optional - filter by chain)
 *   - limit: number (default: 50, max: 100)
 *   - offset: number (default: 0)
 */
activity.get("/swaps", async (c: Context) => {
  try {
    const addressParam = c.req.query("address");
    const chainIdParam = c.req.query("chainId");
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query("limit") || "50") || 50));
    const offset = Math.max(0, parseInt(c.req.query("offset") || "0") || 0);

    if (!addressParam || !isAddress(addressParam)) {
      return c.json({ error: "Invalid or missing address parameter" }, 400);
    }

    const checksumAddress = getAddress(addressParam);
    const chainId = chainIdParam ? parseInt(chainIdParam) : undefined;

    // Build conditions for transactionSwap query
    const swapConditions = [eq(transactionSwap.swapperAddress, checksumAddress)];
    if (chainId !== undefined && !isNaN(chainId)) {
      swapConditions.push(eq(transactionSwap.chainId, chainId));
    }

    // Build conditions for launchpadTrade query
    const tradeConditions = [eq(launchpadTrade.trader, checksumAddress)];
    if (chainId !== undefined && !isNaN(chainId)) {
      tradeConditions.push(eq(launchpadTrade.chainId, chainId));
    }

    // Query DEX swaps with token metadata via LEFT JOIN
    const swapsPromise = db
      .select({
        id: transactionSwap.id,
        txHash: transactionSwap.txHash,
        chainId: transactionSwap.chainId,
        blockNumber: transactionSwap.blockNumber,
        blockTimestamp: transactionSwap.blockTimestamp,
        swapperAddress: transactionSwap.swapperAddress,
        tokenIn: transactionSwap.tokenIn,
        tokenOut: transactionSwap.tokenOut,
        amountIn: transactionSwap.amountIn,
        amountOut: transactionSwap.amountOut,
        // Token metadata from joined tables
        tokenInSymbol: token.symbol,
        tokenInDecimals: token.decimals,
        tokenInName: token.name,
      })
      .from(transactionSwap)
      .leftJoin(token, and(
        eq(transactionSwap.tokenIn, token.address),
        eq(transactionSwap.chainId, token.chainId)
      ))
      .where(and(...swapConditions))
      .orderBy(desc(transactionSwap.blockTimestamp))
      .limit(limit)
      .offset(offset);

    // Query launchpad trades with token metadata
    const tradesPromise = db
      .select({
        id: launchpadTrade.id,
        txHash: launchpadTrade.txHash,
        chainId: launchpadTrade.chainId,
        blockNumber: launchpadTrade.blockNumber,
        timestamp: launchpadTrade.timestamp,
        trader: launchpadTrade.trader,
        tokenAddress: launchpadTrade.tokenAddress,
        isBuy: launchpadTrade.isBuy,
        baseAmount: launchpadTrade.baseAmount,
        tokenAmount: launchpadTrade.tokenAmount,
        // Token metadata from joined table
        tokenSymbol: launchpadToken.symbol,
        tokenName: launchpadToken.name,
      })
      .from(launchpadTrade)
      .leftJoin(launchpadToken, and(
        eq(launchpadTrade.tokenAddress, launchpadToken.address),
        eq(launchpadTrade.chainId, launchpadToken.chainId)
      ))
      .where(and(...tradeConditions))
      .orderBy(desc(launchpadTrade.timestamp))
      .limit(limit)
      .offset(offset);

    // Execute both queries in parallel
    const [swaps, trades] = await Promise.all([swapsPromise, tradesPromise]);

    // Batch fetch tokenOut metadata (avoid N+1 queries)
    const uniqueAddresses = [...new Set(swaps.map((s) => s.tokenOut))];

    const outTokens =
      uniqueAddresses.length > 0
        ? await db
            .select({
              address: token.address,
              chainId: token.chainId,
              symbol: token.symbol,
              decimals: token.decimals,
              name: token.name,
            })
            .from(token)
            .where(inArray(token.address, uniqueAddresses))
        : [];

    // Create lookup map keyed by "address:chainId"
    const outTokenMap = new Map(
      outTokens.map((t) => [`${t.address}:${t.chainId}`, t])
    );

    // Enrich swaps with tokenOut metadata
    const swapsWithOutMetadata = swaps.map((swap) => {
      const outToken = outTokenMap.get(`${swap.tokenOut}:${swap.chainId}`);
      return {
        ...swap,
        tokenOutSymbol: outToken?.symbol || null,
        tokenOutDecimals: outToken?.decimals || null,
        tokenOutName: outToken?.name || null,
      };
    });

    // Get counts for pagination
    const swapCountPromise = db
      .select({ count: count() })
      .from(transactionSwap)
      .where(and(...swapConditions));

    const tradeCountPromise = db
      .select({ count: count() })
      .from(launchpadTrade)
      .where(and(...tradeConditions));

    const [swapCount, tradeCount] = await Promise.all([swapCountPromise, tradeCountPromise]);

    return c.json(
      replaceBigInts(
        {
          swaps: swapsWithOutMetadata,
          launchpadTrades: trades,
          pagination: {
            limit,
            offset,
            swapCount: swapCount[0]?.count || 0,
            tradeCount: tradeCount[0]?.count || 0,
          },
        },
        (v) => String(v)
      )
    );
  } catch (error) {
    console.error("[Activity API] Error fetching swaps:", error);
    return c.json({ error: "Failed to fetch activity" }, 500);
  }
});

export default activity;
