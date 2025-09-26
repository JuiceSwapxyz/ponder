import { Hono, Context } from "hono";
import { cors } from "hono/cors";
// @ts-ignore
import { db } from "ponder:api";
// @ts-ignore
import schema from "ponder:schema";
// @ts-ignore
import { taskCompletion, swap, pool, position } from "ponder:schema";
import { eq, and, desc, count } from "drizzle-orm";

import { graphql } from "ponder"; // @ts-ignore

// Import controllers
import positions from "./controllers/positions";
import pools from "./controllers/pools";
import tokens from "./controllers/tokens";


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

app.use("/graphql", graphql({ db, schema })); 

// Mount API controllers
app.route("/positions", positions);
app.route("/pools", pools);
app.route("/tokens", tokens);

// Campaign Progress API Endpoint (GET with query params)
app.get("/campaign/progress", async (c) => {
  try {
    const walletAddress = c.req.query('walletAddress');
    const chainId = c.req.query('chainId');

    // Log the API request
    console.log(`📊 Campaign API (GET): wallet=${walletAddress}, chain=${chainId}`);

    // Validate input
    if (!walletAddress || !chainId) {
      return c.json({ error: "Missing walletAddress or chainId query parameters" }, 400);
    }


    if (Number(chainId) !== 5115) {
      return c.json({ error: "Only Citrea testnet (chainId: 5115) supported" }, 400);
    }

    // Normalize wallet address
    const normalizedAddress = String(walletAddress).toLowerCase();

    // Query task completions for this wallet using Drizzle ORM
    let taskCompletions: any[] = [];
    try {
      taskCompletions = await db
        .select()
        .from(taskCompletion)
        .where(and(
          eq(taskCompletion.walletAddress, normalizedAddress),
          eq(taskCompletion.chainId, Number(chainId))
        ));
    } catch (dbError) {
      console.warn(`Database query failed for ${normalizedAddress}, using empty results:`, dbError);
      taskCompletions = [];
    }

    // Define all campaign tasks
    const allTasks = [
      {
        id: 1,
        name: "Swap cBTC to NUSD",
        description: "Complete a swap from cBTC to NUSD",
        completed: false,
        completedAt: null as string | null,
        txHash: null as string | null
      },
      {
        id: 2,
        name: "Swap cBTC to cUSD",
        description: "Complete a swap from cBTC to cUSD",
        completed: false,
        completedAt: null as string | null,
        txHash: null as string | null
      },
      {
        id: 3,
        name: "Swap cBTC to USDC",
        description: "Complete a swap from cBTC to USDC",
        completed: false,
        completedAt: null as string | null,
        txHash: null as string | null
      }
    ];

    // Update tasks with completion data
    for (const completion of taskCompletions) {
      const task = allTasks.find(t => t.id === completion.taskId);
      if (task) {
        task.completed = true;
        task.completedAt = new Date(Number(completion.completedAt) * 1000).toISOString();
        task.txHash = completion.txHash;
      }
    }

    // Calculate progress stats
    const completedTasks = allTasks.filter(t => t.completed).length;
    const totalTasks = allTasks.length;
    const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    // Build response
    const response = {
      walletAddress: String(walletAddress),
      chainId: Number(chainId),
      tasks: allTasks,
      totalTasks: totalTasks,
      completedTasks: completedTasks,
      progress: Number(progress.toFixed(2)),
      nftClaimed: false, // Not implemented yet
      claimTxHash: null
    };

    // Log successful response
    console.log(`✅ Campaign response: ${completedTasks}/${totalTasks} tasks (${progress.toFixed(0)}%) for ${String(walletAddress).slice(0,6)}...${String(walletAddress).slice(-4)}`);

    return c.json(response);

  } catch (error) {
    console.error("Campaign progress API error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST version for compatibility with requirements
app.post("/campaign/progress", async (c) => {
  try {
    const body = await c.req.json();
    const { walletAddress, chainId } = body;

    // Log the API request
    console.log(`📊 Campaign API (POST): wallet=${walletAddress}, chain=${chainId}`);

    // Validate input
    if (!walletAddress || !chainId) {
      return c.json({ error: "Missing walletAddress or chainId" }, 400);
    }


    if (chainId !== 5115) {
      return c.json({ error: "Only Citrea testnet (chainId: 5115) supported" }, 400);
    }

    // Normalize wallet address
    const normalizedAddress = walletAddress.toLowerCase();

    // Query task completions for this wallet using Drizzle ORM
    let taskCompletions: any[] = [];
    try {
      taskCompletions = await db
        .select()
        .from(taskCompletion)
        .where(and(
          eq(taskCompletion.walletAddress, normalizedAddress),
          eq(taskCompletion.chainId, chainId)
        ));
    } catch (dbError) {
      console.warn(`Database query failed for ${normalizedAddress}, using empty results:`, dbError);
      taskCompletions = [];
    }

    // Define all campaign tasks
    const allTasks = [
      {
        id: 1,
        name: "Swap cBTC to NUSD",
        description: "Complete a swap from cBTC to NUSD",
        completed: false,
        completedAt: null as string | null,
        txHash: null as string | null
      },
      {
        id: 2,
        name: "Swap cBTC to cUSD",
        description: "Complete a swap from cBTC to cUSD",
        completed: false,
        completedAt: null as string | null,
        txHash: null as string | null
      },
      {
        id: 3,
        name: "Swap cBTC to USDC",
        description: "Complete a swap from cBTC to USDC",
        completed: false,
        completedAt: null as string | null,
        txHash: null as string | null
      }
    ];

    // Update tasks with completion data
    for (const completion of taskCompletions) {
      const task = allTasks.find(t => t.id === completion.taskId);
      if (task) {
        task.completed = true;
        task.completedAt = new Date(Number(completion.completedAt) * 1000).toISOString();
        task.txHash = completion.txHash;
      }
    }

    // Calculate progress stats
    const completedTasks = allTasks.filter(t => t.completed).length;
    const totalTasks = allTasks.length;
    const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    // Build response
    const response = {
      walletAddress: walletAddress,
      chainId: chainId,
      tasks: allTasks,
      totalTasks: totalTasks,
      completedTasks: completedTasks,
      progress: Number(progress.toFixed(2)),
      nftClaimed: false, // Not implemented yet
      claimTxHash: null
    };

    // Log successful response
    console.log(`✅ Campaign response: ${completedTasks}/${totalTasks} tasks (${progress.toFixed(0)}%) for ${walletAddress.slice(0,6)}...${walletAddress.slice(-4)}`);

    return c.json(response);

  } catch (error) {
    console.error("Campaign progress API error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Health endpoint for campaign API
app.get("/campaign/health", async (c) => {
  return c.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    chains: ["citreaTestnet"],
    features: ["campaign-progress"],
    version: "1.0.0"
  });
});


// Get all registered addresses with campaign progress
app.get("/campaign/addresses", async (c: Context) => {
  try {
    const chainId = c.req.query('chainId') || '5115';

    console.log(`📊 Getting all registered addresses for chain=${chainId}`);

    if (Number(chainId) !== 5115) {
      return c.json({ error: "Only Citrea testnet (chainId: 5115) supported" }, 400);
    }

    // Get all unique wallet addresses from taskCompletion table
    const allCompletions = await db
      .select()
      .from(taskCompletion)
      .where(eq(taskCompletion.chainId, Number(chainId)));

    // Group by wallet address and calculate progress
    const addressMap = new Map<string, any>();

    for (const completion of allCompletions) {
      const address = completion.walletAddress;

      if (!addressMap.has(address)) {
        addressMap.set(address, {
          walletAddress: address,
          chainId: Number(chainId),
          completedTasks: 0,
          totalTasks: 3,
          progress: 0,
          tasks: {
            1: false, // Swap cBTC to NUSD
            2: false, // Swap cBTC to cUSD
            3: false  // Swap cBTC to USDC
          },
          lastActivity: null as string | null
        });
      }

      const userData = addressMap.get(address);
      userData.tasks[completion.taskId] = true;

      // Update last activity
      const completedAt = new Date(Number(completion.completedAt) * 1000).toISOString();
      if (!userData.lastActivity || completedAt > userData.lastActivity) {
        userData.lastActivity = completedAt;
      }
    }

    // Calculate progress for each address
    const addresses = Array.from(addressMap.values()).map(userData => {
      const completedCount = Object.values(userData.tasks).filter(Boolean).length;
      return {
        walletAddress: userData.walletAddress,
        completedTasks: completedCount
      };
    });

    // Return in database order (no sorting)
    const response = addresses;

    console.log(`✅ Found ${addresses.length} registered addresses`);

    return c.json(response);

  } catch (error) {
    console.error("Get all addresses API error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Campaign statistics endpoint
app.get("/campaign/stats", async (c: Context) => {
  try {
    const chainId = c.req.query('chainId') || '5115';

    console.log(`📊 Getting campaign statistics for chain=${chainId}`);

    if (Number(chainId) !== 5115) {
      return c.json({ error: "Only Citrea testnet (chainId: 5115) supported" }, 400);
    }

    // Get all unique wallet addresses from taskCompletion table
    const allCompletions = await db
      .select()
      .from(taskCompletion)
      .where(eq(taskCompletion.chainId, Number(chainId)));

    // Group by wallet address and count completed tasks
    const addressMap = new Map<string, number>();

    for (const completion of allCompletions) {
      const address = completion.walletAddress;
      const currentCount = addressMap.get(address) || 0;
      addressMap.set(address, currentCount + 1);
    }

    // Count addresses with all 3 tasks completed
    let addressesWithAllTasks = 0;
    for (const [_, taskCount] of addressMap) {
      if (taskCount === 3) {
        addressesWithAllTasks++;
      }
    }

    const response = {
      totalParticipants: addressMap.size,
      completedAllTasks: addressesWithAllTasks
    };

    console.log(`✅ Campaign stats: ${response.totalParticipants} participants, ${response.completedAllTasks} completed`);

    return c.json(response);

  } catch (error) {
    console.error("Campaign stats API error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Info endpoint
app.get("/api/info", async (c: Context) => {
  return c.json({
    name: "JuiceSwap Ponder",
    version: "1.0.6",
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

    // Get latest indexed block and counts from database
    try {
      // Get latest swap block number
      const latestSwap = await db
        .select()
        .from(swap)
        .orderBy(desc(swap.blockNumber))
        .limit(1);

      if (latestSwap.length > 0) {
        latestIndexedBlock = Number(latestSwap[0].blockNumber);
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
      const rpcUrl = process.env.CITREA_RPC_URL || "https://rpc.testnet.citrea.xyz";
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
        })
      });

      if (response.ok) {
        const data = await response.json();
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

    // Calculate precise sync percentage
    const syncPercentage = (latestIndexedBlock > 0 && currentChainBlock > 0)
      ? Math.min(100, (latestIndexedBlock / currentChainBlock) * 100)
      : 0;

    const blocksBehind = Math.max(0, currentChainBlock - latestIndexedBlock);
    const isSynced = blocksBehind <= 10; // Consider synced if within 10 blocks

    return c.json({
      status: "OK",
      timestamp: new Date().toISOString(),
      sync: {
        latestIndexedBlock,
        currentChainBlock,
        blocksBehind,
        syncPercentage: Number(syncPercentage.toFixed(2)),
        status: isSynced ? "synced" : "syncing"
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
