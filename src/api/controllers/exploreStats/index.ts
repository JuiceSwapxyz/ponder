// @ts-ignore
import { Context, Hono } from "hono";
// @ts-ignore
import { computeTxStats } from "./computeTxStats";
import { computeTokenStats } from "./computeTokenStats";
import { computePoolStatsV3 } from "./computePoolStatsV3";

const exploreStats = new Hono();

exploreStats.get("/", async (c: Context) => {
  try {
    const [transactionStats, tokenStats, poolStatsV3] = await Promise.all([
      computeTxStats(),
      computeTokenStats(),
      computePoolStatsV3(),
    ]);

    return c.json({
      stats: {
        transactionStats,
        tokenStats,
        poolStatsV3,
        dailyProtocolTvl: { v2: [], v3: [], v4: [] },
        historicalProtocolVolume: null,
        poolStats: [],
        poolStatsV2: [],
        poolStatsV4: [],
      },
    });
  } catch (error) {
    console.error("Error fetching explore stats:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default exploreStats;
