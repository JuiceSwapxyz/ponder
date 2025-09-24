import { Hono } from "hono";
// @ts-ignore
import { db } from "ponder:api";
// @ts-ignore
import { taskCompletion } from "ponder:schema";
// @ts-ignore
import { apiQueryLog } from "ponder:schema";
import { eq, and, sql } from "drizzle-orm";

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

    // Log query to database
    try {
      const timestamp = BigInt(Date.now());
      const logId = `${timestamp}:${String(walletAddress).toLowerCase()}`;
      const userAgent = c.req.header('user-agent') || null;
      const ipAddress = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || null;

      await db.insert(apiQueryLog).values({
        id: logId,
        walletAddress: String(walletAddress).toLowerCase(),
        chainId: Number(chainId),
        endpoint: 'GET /campaign/progress',
        queryCount: 1,
        firstQueryAt: timestamp,
        lastQueryAt: timestamp,
        userAgent: userAgent,
        ipAddress: ipAddress,
      }).onConflictDoUpdate((row: any) => ({
        queryCount: sql`${row.queryCount} + 1`,
        lastQueryAt: timestamp,
        userAgent: userAgent,
        ipAddress: ipAddress,
      }));
    } catch (logError) {
      console.warn('Failed to log API query:', logError);
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

    // Log query to database
    try {
      const timestamp = BigInt(Date.now());
      // const logId = `${walletAddress.toLowerCase()}`; // Not used directly
      const userAgent = c.req.header('user-agent') || null;
      const ipAddress = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || null;

      // Check if this wallet already has a log entry
      const existing = await db.select().from(apiQueryLog)
        .where(eq(apiQueryLog.walletAddress, walletAddress.toLowerCase()))
        .limit(1);

      if (existing.length > 0) {
        // Update existing entry
        await db.update(apiQueryLog)
          .set({
            queryCount: sql`${apiQueryLog.queryCount} + 1`,
            lastQueryAt: timestamp,
            userAgent: userAgent,
            ipAddress: ipAddress,
          })
          .where(eq(apiQueryLog.walletAddress, walletAddress.toLowerCase()));
      } else {
        // Create new entry
        await db.insert(apiQueryLog).values({
          id: `${timestamp}:${walletAddress.toLowerCase()}`,
          walletAddress: walletAddress.toLowerCase(),
          chainId: chainId,
          endpoint: 'POST /campaign/progress',
          queryCount: 1,
          firstQueryAt: timestamp,
          lastQueryAt: timestamp,
          userAgent: userAgent,
          ipAddress: ipAddress,
        });
      }
    } catch (logError) {
      console.warn('Failed to log API query:', logError);
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
    features: ["campaign-progress", "query-tracking"],
    version: "1.0.0"
  });
});

// ADMIN ONLY - Get all tracked addresses that made API queries
// TODO: Add authentication before production!
app.get("/admin/tracked-addresses", async (c) => {
  // Check for admin token
  const authHeader = c.req.header('Authorization');
  const adminToken = process.env.ADMIN_API_TOKEN || 'development-only-token';

  if (!authHeader || authHeader !== `Bearer ${adminToken}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  try {
    // Get all unique addresses from the query log
    const queryLogs = await db
      .select()
      .from(apiQueryLog)
      .orderBy(sql`${apiQueryLog.lastQueryAt} DESC`);

    // Transform the data for response - anonymize wallet addresses
    const trackedAddresses = queryLogs.map((log: any) => ({
      walletAddress: `${log.walletAddress.slice(0, 6)}...${log.walletAddress.slice(-4)}`, // Anonymized
      chainId: log.chainId,
      queryCount: log.queryCount,
      firstQueryAt: new Date(Number(log.firstQueryAt)).toISOString(),
      lastQueryAt: new Date(Number(log.lastQueryAt)).toISOString(),
      endpoint: log.endpoint,
    }));

    // Calculate summary statistics
    const totalQueries = trackedAddresses.reduce((sum: number, addr: any) => sum + addr.queryCount, 0);
    const uniqueAddresses = trackedAddresses.length;

    return c.json({
      summary: {
        uniqueAddresses,
        totalQueries,
        timestamp: new Date().toISOString(),
      },
      addresses: trackedAddresses,
    });

  } catch (error) {
    console.error("Error fetching tracked addresses:", error);
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