import { Hono, Context } from "hono";
import { cors } from "hono/cors";
// @ts-ignore
import { db } from "ponder:api";
// @ts-ignore
import schema from "ponder:schema";
// @ts-ignore
import { taskCompletion, swap, pool, position } from "ponder:schema";
import { eq, and, desc, count, gt } from "drizzle-orm";

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
    version: "1.0.7"
  });
});


// Get all registered addresses with campaign progress
app.get("/campaign/addresses", async (c: Context) => {
  try {
    const chainId = c.req.query('chainId') || '5115';


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


    return c.json(response);

  } catch (error) {
    console.error("Campaign stats API error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Campaign daily growth endpoint for charts
app.get("/campaign/daily-growth", async (c: Context) => {
  try {
    const chainId = c.req.query('chainId') || '5115';
    const days = parseInt(c.req.query('days') || '30'); // Last 30 days by default

    if (Number(chainId) !== 5115) {
      return c.json({ error: "Only Citrea testnet (chainId: 5115) supported" }, 400);
    }

    // Get all task completions
    const allCompletions = await db
      .select()
      .from(taskCompletion)
      .where(eq(taskCompletion.chainId, Number(chainId)))
      .orderBy(taskCompletion.completedAt);

    // Group by day
    const dailyData = new Map<string, { date: string; newUsers: Set<string>; totalUsers: Set<string> }>();
    const allUsers = new Set<string>();

    for (const completion of allCompletions) {
      const timestamp = Number(completion.completedAt);
      const date = new Date(timestamp * 1000).toISOString().split('T')[0];

      if (!dailyData.has(date)) {
        dailyData.set(date, {
          date,
          newUsers: new Set(),
          totalUsers: new Set()
        });
      }

      const dayData = dailyData.get(date)!;
      const userKey = completion.walletAddress.toLowerCase();

      // Check if this is user's first activity
      if (!allUsers.has(userKey)) {
        dayData.newUsers.add(userKey);
        allUsers.add(userKey);
      }
    }

    // Convert to array and calculate cumulative
    const result = [];
    let cumulative = 0;

    for (const [date, data] of Array.from(dailyData.entries()).sort()) {
      const newUsers = data.newUsers.size;
      cumulative += newUsers;

      result.push({
        date,
        newUsers,
        cumulative,
        uniqueActiveUsers: data.newUsers.size
      });
    }

    // Limit to requested days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const filtered = result.filter(item => new Date(item.date) >= cutoffDate);

    return c.json({
      chainId: Number(chainId),
      period: `${days} days`,
      data: filtered,
      summary: {
        totalDays: filtered.length,
        totalNewUsers: cumulative,
        averageDaily: Math.round(cumulative / filtered.length) || 0
      }
    });

  } catch (error) {
    console.error("Campaign daily growth API error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Campaign hourly activity endpoint for real-time monitoring
app.get("/campaign/hourly-activity", async (c: Context) => {
  try {
    const chainId = c.req.query('chainId') || '5115';
    const hours = parseInt(c.req.query('hours') || '24'); // Last 24 hours by default

    if (Number(chainId) !== 5115) {
      return c.json({ error: "Only Citrea testnet (chainId: 5115) supported" }, 400);
    }

    const cutoffTime = Math.floor(Date.now() / 1000) - (hours * 3600);

    // Get recent completions
    const recentCompletions = await db
      .select()
      .from(taskCompletion)
      .where(and(
        eq(taskCompletion.chainId, Number(chainId)),
        gt(taskCompletion.completedAt, cutoffTime)
      ))
      .orderBy(taskCompletion.completedAt);

    // Group by hour
    const hourlyData = new Map<string, { hour: string; activities: number; uniqueUsers: Set<string> }>();

    for (const completion of recentCompletions) {
      const timestamp = Number(completion.completedAt);
      const hour = new Date(timestamp * 1000).toISOString().slice(0, 13) + ':00:00Z';

      if (!hourlyData.has(hour)) {
        hourlyData.set(hour, {
          hour,
          activities: 0,
          uniqueUsers: new Set()
        });
      }

      const hourData = hourlyData.get(hour)!;
      hourData.activities++;
      hourData.uniqueUsers.add(completion.walletAddress.toLowerCase());
    }

    // Convert to array
    const result = Array.from(hourlyData.values())
      .map(data => ({
        hour: data.hour,
        activities: data.activities,
        uniqueUsers: data.uniqueUsers.size
      }))
      .sort((a, b) => a.hour.localeCompare(b.hour));

    return c.json({
      chainId: Number(chainId),
      period: `${hours} hours`,
      data: result,
      summary: {
        totalHours: result.length,
        totalActivities: result.reduce((sum, h) => sum + h.activities, 0),
        peakHour: result.reduce((max, h) => h.activities > max.activities ? h : max, result[0])?.hour || null
      }
    });

  } catch (error) {
    console.error("Campaign hourly activity API error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Campaign hourly completion stats for historical tracking
app.get("/campaign/hourly-completion-stats", async (c: Context) => {
  try {
    const chainId = c.req.query('chainId') || '5115';
    const hours = parseInt(c.req.query('hours') || '168'); // Last 7 days by default

    if (Number(chainId) !== 5115) {
      return c.json({ error: "Only Citrea testnet (chainId: 5115) supported" }, 400);
    }

    // Get all completions (we need full history to calculate cumulative stats per hour)
    const allCompletions = await db
      .select()
      .from(taskCompletion)
      .where(eq(taskCompletion.chainId, Number(chainId)))
      .orderBy(taskCompletion.completedAt);

    // Track user progress over time
    const hourlySnapshots = new Map<string, {
      hour: string;
      timestamp: number;
      usersWithAtLeastOneTask: Set<string>;
      usersWithAllTasks: Map<string, Set<number>>;
    }>();

    const userTasksHistory = new Map<string, Set<number>>();

    for (const completion of allCompletions) {
      const timestamp = Number(completion.completedAt);
      const hour = new Date(timestamp * 1000).toISOString().slice(0, 13) + ':00:00Z';
      const userKey = completion.walletAddress.toLowerCase();

      // Update user's task history
      if (!userTasksHistory.has(userKey)) {
        userTasksHistory.set(userKey, new Set());
      }
      userTasksHistory.get(userKey)!.add(completion.taskId);

      // Create snapshot for this hour if it doesn't exist
      if (!hourlySnapshots.has(hour)) {
        hourlySnapshots.set(hour, {
          hour,
          timestamp,
          usersWithAtLeastOneTask: new Set(),
          usersWithAllTasks: new Map()
        });
      }

      const snapshot = hourlySnapshots.get(hour)!;
      snapshot.usersWithAtLeastOneTask.add(userKey);

      // Store the current state of user's tasks at this hour
      snapshot.usersWithAllTasks.set(userKey, new Set(userTasksHistory.get(userKey)));
    }

    // Convert to array and calculate stats
    const sortedSnapshots = Array.from(hourlySnapshots.entries())
      .sort((a, b) => a[0].localeCompare(b[0]));

    // Build cumulative data
    const cumulativeUsers = new Set<string>();
    const cumulativeCompletedUsers = new Set<string>();

    const result = sortedSnapshots.map(([hour, snapshot]) => {
      // Add all users active in this hour to cumulative set
      snapshot.usersWithAtLeastOneTask.forEach(user => cumulativeUsers.add(user));

      // Check which users have completed all 3 tasks by this hour
      for (const [user, tasks] of snapshot.usersWithAllTasks.entries()) {
        if (tasks.size === 3) {
          cumulativeCompletedUsers.add(user);
        }
      }

      return {
        hour,
        totalParticipants: cumulativeUsers.size,
        completedAllTasks: cumulativeCompletedUsers.size,
        completionRate: cumulativeUsers.size > 0
          ? Number(((cumulativeCompletedUsers.size / cumulativeUsers.size) * 100).toFixed(2))
          : 0
      };
    });

    // Filter to requested time window
    const cutoffTime = Math.floor(Date.now() / 1000) - (hours * 3600);
    const filtered = result.filter(item => {
      const itemTime = new Date(item.hour).getTime() / 1000;
      return itemTime >= cutoffTime;
    });

    return c.json({
      chainId: Number(chainId),
      period: `${hours} hours`,
      data: filtered,
      summary: {
        totalHours: filtered.length,
        currentParticipants: filtered[filtered.length - 1]?.totalParticipants || 0,
        currentCompleted: filtered[filtered.length - 1]?.completedAllTasks || 0,
        currentCompletionRate: filtered[filtered.length - 1]?.completionRate || 0
      }
    });

  } catch (error) {
    console.error("Campaign hourly completion stats API error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

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
      const rpcUrl = process.env.CITREA_RPC_URL || "http://vm-dfx-node-prd.westeurope.cloudapp.azure.com:8085";
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
