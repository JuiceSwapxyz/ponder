import { Hono, Context } from "hono";
import { cors } from "hono/cors";
// @ts-ignore
import { db } from "ponder:api";
// @ts-ignore
import schema from "ponder:schema";
// @ts-ignore
import { swap, pool, position } from "ponder:schema";
import { count } from "drizzle-orm";

import { graphql } from "ponder"; // @ts-ignore

// Import controllers
import positions from "./controllers/positions";
import tokens from "./controllers/tokens";
import launchpad from "./controllers/launchpad";
import graduatedPools from "./controllers/graduatedPools";
import activity from "./controllers/activity";
import v2PoolStats from "./controllers/v2PoolStats";
import { blockProgress } from "ponder.schema";

// Import middleware
import { syncCheckMiddleware } from "./middleware/syncCheck";
import campaing from "./controllers/campaign";


const app = new Hono();

// Enable CORS for all juiceswap.com domains
app.use('/*', cors({
  origin: (origin) => {
    if (!origin) return null;
    // Allow all subdomains of juiceswap.com
    if (origin.endsWith('.juiceswap.com') || origin === 'https://juiceswap.com') {
      return origin;
    }
    // Allow localhost for development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return origin;
    }
    return null;
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization']
}));

// Apply sync check middleware to all routes (whitelisted paths are excluded in middleware)
app.use('/*', syncCheckMiddleware);

const graphqlMiddleware = graphql({ db, schema });
app.use("/graphql", graphqlMiddleware); 
app.use("/playground", graphqlMiddleware); // Unconstrained by sync check

// Mount API controllers
app.route("/positions", positions);
app.route("/tokens", tokens);
app.route("/campaign", campaing);
app.route("/launchpad", launchpad);
app.route("/graduated-pools", graduatedPools);
app.route("/activity", activity);
app.route("/v2-pool-stats", v2PoolStats);

// Info endpoint
app.get("/api/info", async (c: Context) => {
  return c.json({
    name: "JuiceSwap Ponder",
    version: "1.0.7",
    chain: "citreaTestnet",
    contracts: {
      CBTCNUSDPool: "0x6006797369E2A595D31Df4ab3691044038AAa7FE",
      CBTCcUSDPool: "0xA69De906B9A830Deb64edB97B2eb0848139306d2",
      CBTCUSDCPool: "0xD8C7604176475eB8D350bC1EE452dA4442637C09"
    }
  });
});

// Sync status endpoint
app.get("/api/sync-status", async (c: Context) => {
  try {
    let latestIndexedBlock = 0;
    let currentChainBlock = 0;
    let swapCount = 0;
    let poolCount = 0;
    let positionCount = 0;

    // Define the start block from ponder.config.ts
    const START_BLOCK = 15455001;

    // Get latest indexed block and counts from database
    try {
      const latestBlockProgress = await db
        .select()
        .from(blockProgress)
        .limit(1);

      if (latestBlockProgress.length > 0) {
        latestIndexedBlock = Number(latestBlockProgress[0].blockNumber);
      }

      // Get counts
      const swapCountResult = await db.select({ count: count() }).from(swap);
      swapCount = swapCountResult[0]?.count || 0;

      const poolCountResult = await db.select({ count: count() }).from(pool);
      poolCount = poolCountResult[0]?.count || 0;

      const positionCountResult = await db.select({ count: count() }).from(position);
      positionCount = positionCountResult[0]?.count || 0;
    } catch (dbError) {
      console.warn("Failed to query database:", dbError);
    }

    // Get current block number from Citrea RPC
    try {
      const rpcUrl = process.env.CITREA_RPC_URL ?? 'https://rpc.testnet.juiceswap.com/';

      // Add 10 second timeout to RPC call
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
          // Convert hex to decimal
          currentChainBlock = parseInt(data.result, 16);
        }
      }
    } catch (rpcError) {
      console.warn("Failed to fetch current block from RPC:", rpcError);
      // Fallback to estimate if RPC fails
      currentChainBlock = Math.max(latestIndexedBlock + 1000, 1500000);
    }

    // Calculate precise sync percentage based on actual progress from start block
    const blocksProcessed = Math.max(0, latestIndexedBlock - START_BLOCK);
    const totalBlocksToProcess = Math.max(1, currentChainBlock - START_BLOCK);
    const syncPercentage = (latestIndexedBlock > 0 && currentChainBlock > START_BLOCK)
      ? Math.min(100, (blocksProcessed / totalBlocksToProcess) * 100)
      : 0;

    const blocksBehind = Math.max(0, currentChainBlock - latestIndexedBlock);
    const isSynced = blocksBehind <= 100; // Consider synced if within 100 blocks

    // Return 503 Service Unavailable if still syncing
    if (!isSynced) {
      return c.json({
        status: "SYNCING",
        timestamp: new Date().toISOString(),
        sync: {
          latestIndexedBlock,
          currentChainBlock,
          blocksBehind,
          syncPercentage: Number(syncPercentage.toFixed(2)),
          status: "syncing"
        },
        stats: {
          swaps: swapCount,
          pools: poolCount,
          positions: positionCount
        },
        message: "Indexer is currently syncing. Please retry in a few moments."
      }, 503);
    }

    // Return 200 OK if synced
    return c.json({
      status: "OK",
      timestamp: new Date().toISOString(),
      sync: {
        latestIndexedBlock,
        currentChainBlock,
        blocksBehind,
        syncPercentage: Number(syncPercentage.toFixed(2)),
        status: "synced"
      },
      stats: {
        swaps: swapCount,
        pools: poolCount,
        positions: positionCount
      }
    });
  } catch (error) {
    console.error("Sync status error:", error);
    return c.json({
      status: "ERROR",
      error: "Failed to get sync status",
      timestamp: new Date().toISOString()
    }, 500);
  }
});

export default app;
