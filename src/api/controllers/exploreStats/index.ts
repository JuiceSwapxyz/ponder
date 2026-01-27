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

// Supported chain IDs
const SUPPORTED_CHAIN_IDS = [5115, 4114]; // Citrea Testnet, Citrea Mainnet
const DEFAULT_CHAIN_ID = 5115; // Default to testnet for backwards compatibility

exploreStats.get("/", async (c: Context) => {
  try {
    // Parse chainId from query parameter
    const chainIdParam = c.req.query('chainId');
    const chainId = chainIdParam ? parseInt(chainIdParam, 10) : DEFAULT_CHAIN_ID;

    // Validate chainId
    if (!SUPPORTED_CHAIN_IDS.includes(chainId)) {
      return c.json({
        error: `Unsupported chainId. Supported: ${SUPPORTED_CHAIN_IDS.join(', ')}`
      }, 400);
    }

    const cacheKey = `exploreStats:${chainId}`;
    c.header('Cache-Control', 'public, max-age=60');

    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      c.header('X-Cache', 'HIT');
      return c.json(cachedData);
    }

    c.header('X-Cache', 'MISS');
    const [transactionStats, tokenStats, poolStatsV3, poolStatsV2] = await Promise.all([
      computeTxStats(chainId),
      computeTokenStats(chainId),
      computePoolStatsV3(chainId),
      computePoolStatsV2(chainId),
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
