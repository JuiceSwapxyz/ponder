import { Hono } from "hono";
// @ts-ignore
import { db } from "ponder:api";
// @ts-ignore
import { taskCompletion } from "ponder:schema";
import { eq, and } from "drizzle-orm";

const app = new Hono();

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


// Campaign statistics endpoint
app.get("/campaign/stats", async (c) => {
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
app.get("/api/info", async (c) => {
  return c.json({
    name: "JuiceSwap Ponder",
    version: "1.0.0",
    chain: "citreaTestnet",
    contracts: {
      CBTCNUSDPool: "0x6006797369E2A595D31Df4ab3691044038AAa7FE",
      CBTCcUSDPool: "0xA69De906B9A830Deb64edB97B2eb0848139306d2",
      CBTCUSDCPool: "0xD8C7604176475eB8D350bC1EE452dA4442637C09"
    }
  });
});

export default app;