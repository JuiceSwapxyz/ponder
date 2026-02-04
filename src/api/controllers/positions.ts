import { Hono, Context } from "hono";
// @ts-ignore
import { db } from "ponder:api";
// @ts-ignore
import { position, pool, token, Position } from "ponder:schema";
import { eq, and, inArray } from "drizzle-orm";
import { getAddress } from "viem";

const positions = new Hono();

// Helper function to aggregate position data
const aggregatePosition = async (pos: any) => {
  // Get pool data
  const poolData = pos.poolAddress ? await db
    .select()
    .from(pool)
    .where(eq(pool.address, pos.poolAddress))
    .limit(1) : [];

  // Get token0 data
  const token0Data = poolData.length > 0 && poolData[0].token0 ? await db
    .select()
    .from(token)
    .where(eq(token.address, poolData[0].token0))
    .limit(1) : [];

  // Get token1 data
  const token1Data = poolData.length > 0 && poolData[0].token1 ? await db
    .select()
    .from(token)
    .where(eq(token.address, poolData[0].token1))
    .limit(1) : [];

  const poolInfo = poolData[0];
  const token0Info = token0Data[0];
  const token1Info = token1Data[0];

  return {
    chainId: pos.chainId,
    protocolVersion: "PROTOCOL_VERSION_V3",
    case: 'v3Position',
    v3Position: {
      tokenId: pos.tokenId || "0",
      tickLower: pos.tickLower?.toString() || "-887220",
      tickUpper: pos.tickUpper?.toString() || "887220",
      liquidity: "37945455597966861",
      token0: {
        chainId: token0Info?.chainId,
        address: token0Info?.address || "0x131a8656275bDd1130E0213414F3DA47C8C2a402",
        symbol: token0Info?.symbol || "DNN7",
        decimals: token0Info?.decimals || 18,
        name: token0Info?.name || "DnnToken6"
      },
      token1: {
        chainId: token1Info?.chainId,
        address: token1Info?.address || "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
        symbol: token1Info?.symbol || "WETH",
        decimals: token1Info?.decimals || 18,
        name: token1Info?.name || "Wrapped Ether"
      },
      feeTier: poolInfo?.fee?.toString() || "3000",
      currentTick: "-115136",
      currentPrice: "250529060232794967902094762",
      tickSpacing: poolInfo?.tickSpacing?.toString() || "60",
      token0UncollectedFees: "0",
      token1UncollectedFees: "0",
      amount0: pos.amount0?.toString() || "0",
      amount1: pos.amount1?.toString() || "0",
      poolId: pos.poolAddress || "0xDb2d6eb17997F45BD32904798774b7ea654F3223",
      totalLiquidityUsd: "5.265636176503667857671428106519472",
      currentLiquidity: "104350002894409105",
      case: 'v3Position',
    },
    status: "POSITION_STATUS_IN_RANGE",
    timestamp: Math.floor(Date.now() / 1000)
  };
};

// Get all positions for a specific owner
positions.post("/owner", async (c: Context) => {
  try {
    const body = await c.req.json();
    const chainIds: number[] | undefined = body.chainIds;
    const ownerAddress = body.address;

    if (!ownerAddress) {
      return c.json({ error: "Owner address is required" }, 400);
    }

    const normalizedAddress = getAddress(ownerAddress);

    const whereClause = chainIds 
      ? and(eq(position.owner, normalizedAddress), inArray(position.chainId, chainIds)) 
      : eq(position.owner, normalizedAddress);

    const userPositions = await db
      .select()
      .from(position)
      .where(whereClause);

    // Aggregate positions with related data
    const aggregatedPositions = await Promise.all(
      userPositions.map((pos: Position) => aggregatePosition(pos))
    );

    return c.json({
      positions: aggregatedPositions,
    });
  } catch (error) {
    console.error("Get positions by owner error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default positions;
