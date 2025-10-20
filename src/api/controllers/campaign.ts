import { Hono, Context } from "hono";
// @ts-ignore
import { db } from "ponder:api";
// @ts-ignore
import { taskCompletion, nftClaim } from "ponder:schema";
import { eq, and, gt } from "drizzle-orm";
import NodeCache from "node-cache";

const cache = new NodeCache({
  stdTTL: 1800,
  checkperiod: 30,
  useClones: false,
});

const campaing = new Hono();

// Campaign Progress API Endpoint (GET with query params)
campaing.get("/progress", async (c) => {
  try {
    const walletAddress = c.req.query("walletAddress");
    const chainId = c.req.query("chainId");

    // Validate input
    if (!walletAddress || !chainId) {
      return c.json(
        { error: "Missing walletAddress or chainId query parameters" },
        400
      );
    }

    if (Number(chainId) !== 5115) {
      return c.json(
        { error: "Only Citrea testnet (chainId: 5115) supported" },
        400
      );
    }

    // Normalize wallet address
    const normalizedAddress = String(walletAddress).toLowerCase();

    // Query task completions for this wallet using Drizzle ORM
    let taskCompletions: any[] = [];
    try {
      taskCompletions = await db
        .select()
        .from(taskCompletion)
        .where(
          and(
            eq(taskCompletion.walletAddress, normalizedAddress),
            eq(taskCompletion.chainId, Number(chainId))
          )
        );
    } catch (dbError) {
      console.warn(
        `Database query failed for ${normalizedAddress}, using empty results:`,
        dbError
      );
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
        txHash: null as string | null,
      },
      {
        id: 2,
        name: "Swap cBTC to cUSD",
        description: "Complete a swap from cBTC to cUSD",
        completed: false,
        completedAt: null as string | null,
        txHash: null as string | null,
      },
      {
        id: 3,
        name: "Swap cBTC to USDC",
        description: "Complete a swap from cBTC to USDC",
        completed: false,
        completedAt: null as string | null,
        txHash: null as string | null,
      },
    ];

    // Update tasks with completion data
    for (const completion of taskCompletions) {
      const task = allTasks.find((t) => t.id === completion.taskId);
      if (task) {
        task.completed = true;
        task.completedAt = new Date(
          Number(completion.completedAt) * 1000
        ).toISOString();
        task.txHash = completion.txHash;
      }
    }

    // Calculate progress stats
    const completedTasks = allTasks.filter((t) => t.completed).length;
    const totalTasks = allTasks.length;
    const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    // Query NFT claim status
    let nftClaimData = null;
    try {
      const nftClaims = await db
        .select()
        .from(nftClaim)
        .where(
          and(
            eq(nftClaim.walletAddress, normalizedAddress),
            eq(nftClaim.chainId, Number(chainId))
          )
        )
        .limit(1);

      nftClaimData = nftClaims.length > 0 ? nftClaims[0] : null;
    } catch (dbError) {
      console.warn(`NFT claim query failed for ${normalizedAddress}:`, dbError);
    }

    // Build response
    const response = {
      walletAddress: String(walletAddress),
      chainId: Number(chainId),
      tasks: allTasks,
      totalTasks: totalTasks,
      completedTasks: completedTasks,
      progress: Number(progress.toFixed(2)),
      nftClaimed: !!nftClaimData,
      claimTxHash: nftClaimData?.txHash || null,
    };

    return c.json(response);
  } catch (error) {
    console.error("Campaign progress API error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST version for compatibility with requirements
campaing.post("/progress", async (c) => {
  try {
    const body = await c.req.json();
    const { walletAddress, chainId } = body;

    // Validate input
    if (!walletAddress || !chainId) {
      return c.json({ error: "Missing walletAddress or chainId" }, 400);
    }

    if (chainId !== 5115) {
      return c.json(
        { error: "Only Citrea testnet (chainId: 5115) supported" },
        400
      );
    }

    // Normalize wallet address
    const normalizedAddress = walletAddress.toLowerCase();

    // Query task completions for this wallet using Drizzle ORM
    let taskCompletions: any[] = [];
    try {
      taskCompletions = await db
        .select()
        .from(taskCompletion)
        .where(
          and(
            eq(taskCompletion.walletAddress, normalizedAddress),
            eq(taskCompletion.chainId, chainId)
          )
        );
    } catch (dbError) {
      console.warn(
        `Database query failed for ${normalizedAddress}, using empty results:`,
        dbError
      );
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
        txHash: null as string | null,
      },
      {
        id: 2,
        name: "Swap cBTC to cUSD",
        description: "Complete a swap from cBTC to cUSD",
        completed: false,
        completedAt: null as string | null,
        txHash: null as string | null,
      },
      {
        id: 3,
        name: "Swap cBTC to USDC",
        description: "Complete a swap from cBTC to USDC",
        completed: false,
        completedAt: null as string | null,
        txHash: null as string | null,
      },
    ];

    // Update tasks with completion data
    for (const completion of taskCompletions) {
      const task = allTasks.find((t) => t.id === completion.taskId);
      if (task) {
        task.completed = true;
        task.completedAt = new Date(
          Number(completion.completedAt) * 1000
        ).toISOString();
        task.txHash = completion.txHash;
      }
    }

    // Calculate progress stats
    const completedTasks = allTasks.filter((t) => t.completed).length;
    const totalTasks = allTasks.length;
    const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    // Query NFT claim status
    let nftClaimData = null;
    try {
      const nftClaims = await db
        .select()
        .from(nftClaim)
        .where(
          and(
            eq(nftClaim.walletAddress, normalizedAddress),
            eq(nftClaim.chainId, Number(chainId))
          )
        )
        .limit(1);

      nftClaimData = nftClaims.length > 0 ? nftClaims[0] : null;
    } catch (dbError) {
      console.warn(`NFT claim query failed for ${normalizedAddress}:`, dbError);
    }

    // Build response
    const response = {
      walletAddress: walletAddress,
      chainId: chainId,
      tasks: allTasks,
      totalTasks: totalTasks,
      completedTasks: completedTasks,
      progress: Number(progress.toFixed(2)),
      nftClaimed: !!nftClaimData,
      claimTxHash: nftClaimData?.txHash || null,
    };

    return c.json(response);
  } catch (error) {
    console.error("Campaign progress API error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Health endpoint for campaign API
campaing.get("/health", async (c) => {
  return c.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    chains: ["citreaTestnet"],
    features: ["campaign-progress"],
    version: "1.0.7",
  });
});

// Get all registered addresses with campaign progress
campaing.get("/addresses", async (c: Context) => {
  try {
    const chainId = c.req.query("chainId") || "5115";

    if (Number(chainId) !== 5115) {
      return c.json(
        { error: "Only Citrea testnet (chainId: 5115) supported" },
        400
      );
    }

    const allCompletions = await db
      .select()
      .from(taskCompletion)
      .where(eq(taskCompletion.chainId, Number(chainId)));

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
            3: false, // Swap cBTC to USDC
          },
          lastActivity: null as string | null,
        });
      }

      const userData = addressMap.get(address);
      userData.tasks[completion.taskId] = true;

      // Update last activity
      const completedAt = new Date(
        Number(completion.completedAt) * 1000
      ).toISOString();
      if (!userData.lastActivity || completedAt > userData.lastActivity) {
        userData.lastActivity = completedAt;
      }
    }

    // Calculate progress for each address
    const addresses = Array.from(addressMap.values()).map((userData) => {
      const completedCount = Object.values(userData.tasks).filter(
        Boolean
      ).length;
      return {
        walletAddress: userData.walletAddress,
        completedTasks: completedCount,
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
campaing.get("/stats", async (c: Context) => {
  try {
    const chainId = c.req.query("chainId") || "5115";

    if (Number(chainId) !== 5115) {
      return c.json(
        { error: "Only Citrea testnet (chainId: 5115) supported" },
        400
      );
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
      completedAllTasks: addressesWithAllTasks,
    };

    return c.json(response);
  } catch (error) {
    console.error("Campaign stats API error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Campaign daily growth endpoint for charts
campaing.get("/daily-growth", async (c: Context) => {
  try {
    const chainId = c.req.query("chainId") || "5115";
    const days = parseInt(c.req.query("days") || "30");

    if (Number(chainId) !== 5115) {
      return c.json(
        { error: "Only Citrea testnet (chainId: 5115) supported" },
        400
      );
    }

    // Check cache
    const cacheKey = `daily-growth:${chainId}:${days}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      c.header("X-Cache", "HIT");
      return c.json(cached);
    }

    // Get all task completions
    const allCompletions = await db
      .select()
      .from(taskCompletion)
      .where(eq(taskCompletion.chainId, Number(chainId)))
      .orderBy(taskCompletion.completedAt);

    // Group by day
    const dailyData = new Map<
      string,
      { date: string; newUsers: Set<string>; totalUsers: Set<string> }
    >();
    const allUsers = new Set<string>();

    for (const completion of allCompletions) {
      const timestamp = Number(completion.completedAt);
      const date = new Date(timestamp * 1000).toISOString().split("T")[0];

      if (!dailyData.has(date)) {
        dailyData.set(date, {
          date,
          newUsers: new Set(),
          totalUsers: new Set(),
        });
      }

      const dayData = dailyData.get(date)!;
      const userKey = completion.walletAddress.toLowerCase();

      if (!allUsers.has(userKey)) {
        dayData.newUsers.add(userKey);
        allUsers.add(userKey);
      }
    }

    const result = [];
    let cumulative = 0;

    for (const [date, data] of Array.from(dailyData.entries()).sort()) {
      const newUsers = data.newUsers.size;
      cumulative += newUsers;

      result.push({
        date,
        newUsers,
        cumulative,
        uniqueActiveUsers: data.newUsers.size,
      });
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const filtered = result.filter((item) => new Date(item.date) >= cutoffDate);

    const response = {
      chainId: Number(chainId),
      period: `${days} days`,
      data: filtered,
      summary: {
        totalDays: filtered.length,
        totalNewUsers: cumulative,
        averageDaily: Math.round(cumulative / filtered.length) || 0,
      },
    };

    // Store in cache
    cache.set(cacheKey, response);

    return c.json(response);
  } catch (error) {
    console.error("Campaign daily growth API error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Campaign hourly activity endpoint for real-time monitoring
campaing.get("/hourly-activity", async (c: Context) => {
  try {
    const chainId = c.req.query("chainId") || "5115";
    const hours = parseInt(c.req.query("hours") || "24");

    if (Number(chainId) !== 5115) {
      return c.json(
        { error: "Only Citrea testnet (chainId: 5115) supported" },
        400
      );
    }

    const cutoffTime = Math.floor(Date.now() / 1000) - hours * 3600;

    const recentCompletions = await db
      .select()
      .from(taskCompletion)
      .where(
        and(
          eq(taskCompletion.chainId, Number(chainId)),
          gt(taskCompletion.completedAt, cutoffTime)
        )
      )
      .orderBy(taskCompletion.completedAt);

    const hourlyData = new Map<
      string,
      { hour: string; activities: number; uniqueUsers: Set<string> }
    >();

    for (const completion of recentCompletions) {
      const timestamp = Number(completion.completedAt);
      const hour =
        new Date(timestamp * 1000).toISOString().slice(0, 13) + ":00:00Z";

      if (!hourlyData.has(hour)) {
        hourlyData.set(hour, {
          hour,
          activities: 0,
          uniqueUsers: new Set(),
        });
      }

      const hourData = hourlyData.get(hour)!;
      hourData.activities++;
      hourData.uniqueUsers.add(completion.walletAddress.toLowerCase());
    }

    // Convert to array
    const result = Array.from(hourlyData.values())
      .map((data) => ({
        hour: data.hour,
        activities: data.activities,
        uniqueUsers: data.uniqueUsers.size,
      }))
      .sort((a, b) => a.hour.localeCompare(b.hour));

    return c.json({
      chainId: Number(chainId),
      period: `${hours} hours`,
      data: result,
      summary: {
        totalHours: result.length,
        totalActivities: result.reduce((sum, h) => sum + h.activities, 0),
        peakHour:
          result.reduce(
            (max, h) => (h.activities > max.activities ? h : max),
            result[0]
          )?.hour || null,
      },
    });
  } catch (error) {
    console.error("Campaign hourly activity API error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

campaing.get("/hourly-completion-stats", async (c: Context) => {
  try {
    const chainId = c.req.query("chainId") || "5115";
    const hours = parseInt(c.req.query("hours") || "168"); // Last 7 days by default

    if (Number(chainId) !== 5115) {
      return c.json(
        { error: "Only Citrea testnet (chainId: 5115) supported" },
        400
      );
    }

    // Check cache
    const cacheKey = `hourly-completion-stats:${chainId}:${hours}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      c.header("X-Cache", "HIT");
      return c.json(cached);
    }

    const allCompletions = await db
      .select()
      .from(taskCompletion)
      .where(eq(taskCompletion.chainId, Number(chainId)))
      .orderBy(taskCompletion.completedAt);

    // Track user progress over time
    const hourlySnapshots = new Map<
      string,
      {
        hour: string;
        timestamp: number;
        usersWithAtLeastOneTask: Set<string>;
        usersWithAllTasks: Map<string, Set<number>>;
      }
    >();

    const userTasksHistory = new Map<string, Set<number>>();

    for (const completion of allCompletions) {
      const timestamp = Number(completion.completedAt);
      const hour =
        new Date(timestamp * 1000).toISOString().slice(0, 13) + ":00:00Z";
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
          usersWithAllTasks: new Map(),
        });
      }

      const snapshot = hourlySnapshots.get(hour)!;
      snapshot.usersWithAtLeastOneTask.add(userKey);

      // Store the current state of user's tasks at this hour
      snapshot.usersWithAllTasks.set(
        userKey,
        new Set(userTasksHistory.get(userKey))
      );
    }

    // Convert to array and calculate stats
    const sortedSnapshots = Array.from(hourlySnapshots.entries()).sort((a, b) =>
      a[0].localeCompare(b[0])
    );

    // Build cumulative data
    const cumulativeUsers = new Set<string>();
    const cumulativeCompletedUsers = new Set<string>();

    const result = sortedSnapshots.map(([hour, snapshot]) => {
      // Add all users active in this hour to cumulative set
      snapshot.usersWithAtLeastOneTask.forEach((user) =>
        cumulativeUsers.add(user)
      );

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
        completionRate:
          cumulativeUsers.size > 0
            ? Number(
                (
                  (cumulativeCompletedUsers.size / cumulativeUsers.size) *
                  100
                ).toFixed(2)
              )
            : 0,
      };
    });

    // Filter to requested time window
    const cutoffTime = Math.floor(Date.now() / 1000) - hours * 3600;
    const filtered = result.filter((item) => {
      const itemTime = new Date(item.hour).getTime() / 1000;
      return itemTime >= cutoffTime;
    });

    const response = {
      chainId: Number(chainId),
      period: `${hours} hours`,
      data: filtered,
      summary: {
        totalHours: filtered.length,
        currentParticipants:
          filtered[filtered.length - 1]?.totalParticipants || 0,
        currentCompleted: filtered[filtered.length - 1]?.completedAllTasks || 0,
        currentCompletionRate:
          filtered[filtered.length - 1]?.completionRate || 0,
      },
    };

    // Store in cache
    cache.set(cacheKey, response);

    return c.json(response);
  } catch (error) {
    console.error("Campaign hourly completion stats API error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default campaing;
