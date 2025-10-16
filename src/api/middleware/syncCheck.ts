import { Context, Next } from "hono";
// @ts-ignore
import { db } from "ponder:api";
// @ts-ignore
import { blockProgress } from "ponder.schema";

let cachedSyncStatus: { isSynced: boolean; timestamp: number } | null = null;
const CACHE_TTL = 5000;

/**
 * Get current sync status from database
 * Returns true if Ponder is synced (within 500 blocks of chain tip)
 */
async function getSyncStatus(): Promise<boolean> {
  if (cachedSyncStatus && Date.now() - cachedSyncStatus.timestamp < CACHE_TTL) {
    return cachedSyncStatus.isSynced;
  }

  try {
    const latestBlockProgress = await db
      .select()
      .from(blockProgress)
      .limit(1);

    const latestIndexedBlock = latestBlockProgress.length > 0
      ? Number(latestBlockProgress[0].blockNumber)
      : 0;

    let currentChainBlock = 0;
    try {
      const rpcUrl = process.env.CITREA_RPC_URL ?? "https://rpc.testnet.juiceswap.com/";

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
      currentChainBlock = latestIndexedBlock;
    }

    const blocksBehind = Math.max(0, currentChainBlock - latestIndexedBlock);
    const isSynced = blocksBehind <= 500;

    cachedSyncStatus = {
      isSynced,
      timestamp: Date.now()
    };

    return isSynced;
  } catch (error) {
    console.error('Error checking sync status:', error);
    // On error, assume not synced to be safe and prevent serving stale data
    return false;
  }
}

/**
 * Middleware that blocks requests while Ponder is syncing
 * Whitelisted endpoints are always accessible
 */
export async function syncCheckMiddleware(c: Context, next: Next) {
  const whitelistedPaths = [
    '/api/sync-status',
    '/api/info',
    '/campaign/health',
    '/graphql',
  ];

  const path = new URL(c.req.url).pathname;

  if (whitelistedPaths.some(whitelist => path.startsWith(whitelist))) {
    await next();
    return;
  }

  const isSynced = await getSyncStatus();

  if (!isSynced) {
    return c.json({
      error: "Service Unavailable",
      message: "Indexer is currently syncing. Please try again in a few moments.",
      code: "INDEXER_SYNCING",
      timestamp: new Date().toISOString()
    }, 503);
  }

  await next();
}

/**
 * Clear the sync status cache (useful for testing)
 */
export function clearSyncStatusCache() {
  cachedSyncStatus = null;
}
