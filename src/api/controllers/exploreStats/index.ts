// @ts-ignore
import { Context, Hono } from "hono";
import NodeCache from "node-cache";
// @ts-ignore
import { computeTxStats } from "./computeTxStats";
import { computeTokenStats } from "./computeTokenStats";
import { computePoolStatsV3 } from "./computePoolStatsV3";
import { computePoolStatsV2 } from "./computePoolStatsV2";

const exploreStats = new Hono();

const cache = new NodeCache({ 
  stdTTL: 60,
  checkperiod: 30,
  useClones: false
});

exploreStats.get("/", async (c: Context) => {
  try {
    const cacheKey = "exploreStats";
    c.header('Cache-Control', 'public, max-age=60');
    
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      c.header('X-Cache', 'HIT');
      return c.json(cachedData);
    }

    c.header('X-Cache', 'MISS');
    const [transactionStats, tokenStats, poolStatsV3, poolStatsV2] = await Promise.all([
      computeTxStats(),
      computeTokenStats(),
      computePoolStatsV3(),
      computePoolStatsV2(),
    ]);

    const responseData = {
      stats: {
        transactionStats,
        tokenStats,
        poolStatsV3,
        dailyProtocolTvl: { v2: [], v3: [], v4: [] },
        historicalProtocolVolume: null,
        poolStats: [],
        poolStatsV2,
        poolStatsV4: [],
      },
    };

    cache.set(cacheKey, responseData);
    return c.json(responseData);
  } catch (error) {
    console.error("Error fetching explore stats:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default exploreStats;
