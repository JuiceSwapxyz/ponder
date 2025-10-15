import { Context, Next } from "hono";
// @ts-ignore
import { db } from "ponder:api";
// @ts-ignore
import { swap } from "ponder:schema";
import { desc } from "drizzle-orm";

// Start block from ponder.config.ts
const START_BLOCK = 15455001;

// Cache sync status to avoid repeated database queries
let cachedSyncStatus: { isSynced: boolean; timestamp: number } | null = null;
const CACHE_TTL = 5000; // 5 seconds cache

/**
 * Get current sync status from database
 * Returns true if Ponder is synced (within 100 blocks of chain tip)
 */
async function getSyncStatus(): Promise<boolean> {
  // Return cached status if still valid
  if (cachedSyncStatus && Date.now() - cachedSyncStatus.timestamp < CACHE_TTL) {
    return cachedSyncStatus.isSynced;
  }

  try {
    // Get latest indexed block from database
    const latestSwap = await db
      .select()
      .from(swap)
      .orderBy(desc(swap.blockNumber))
      .limit(1);

    const latestIndexedBlock = latestSwap.length > 0
      ? Number(latestSwap[0].blockNumber)
      : 0;

    // Get current chain block from RPC
    let currentChainBlock = 0;
    try {
      const rpcUrl = process.env.CITREA_RPC_URL;
      if (!rpcUrl) {
        throw new Error('CITREA_RPC_URL not configured');
      }

      // Add 10 second timeout to RPC call
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_blockNumber",
          params: [],
          id: 1
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json() as { result?: string };
        if (data.result) {
          currentChainBlock = parseInt(data.result, 16);
        }
      }
    } catch (rpcError) {
      console.warn('Failed to fetch current block from RPC:', rpcError);
      // If RPC fails, assume we're synced to avoid blocking
      currentChainBlock = latestIndexedBlock;
    }

    // Calculate if synced (within 100 blocks of chain tip)
    const blocksBehind = Math.max(0, currentChainBlock - latestIndexedBlock);
    const isSynced = blocksBehind <= 100;

    // Cache the result
    cachedSyncStatus = {
      isSynced,
      timestamp: Date.now()
    };

    return isSynced;
  } catch (error) {
    console.error('Error checking sync status:', error);
    // On error, assume synced to avoid blocking
    return true;
  }
}

/**
 * Middleware that blocks requests while Ponder is syncing
 * Whitelisted endpoints are always accessible
 */
export async function syncCheckMiddleware(c: Context, next: Next) {
  // Whitelist of endpoints that should always be accessible
  const whitelistedPaths = [
    '/api/sync-status',
    '/api/info',
    '/campaign/health',
    '/graphql', // GraphQL endpoint should remain accessible
  ];

  const path = new URL(c.req.url).pathname;

  // Allow whitelisted paths through without checking sync status
  if (whitelistedPaths.some(whitelist => path.startsWith(whitelist))) {
    await next();
    return;
  }

  // Check sync status for all other endpoints
  const isSynced = await getSyncStatus();

  if (!isSynced) {
    return c.json({
      error: "Service Unavailable",
      message: "Indexer is currently syncing. Please try again in a few moments.",
      code: "INDEXER_SYNCING",
      timestamp: new Date().toISOString()
    }, 503);
  }

  // Ponder is synced, allow request through
  await next();
}

/**
 * Clear the sync status cache (useful for testing)
 */
export function clearSyncStatusCache() {
  cachedSyncStatus = null;
}
