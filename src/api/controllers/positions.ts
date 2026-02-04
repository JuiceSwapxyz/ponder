import { Hono, Context } from "hono";
// @ts-ignore
import { db } from "ponder:api";
// @ts-ignore
import { position, pool, token, Position } from "ponder:schema";
import { eq, and, inArray } from "drizzle-orm";
import { getAddress } from "viem";

const positions = new Hono();

// Helper function to aggregate position data with indexed values only
const aggregatePosition = async (pos: any) => {
  // Get pool data
  const poolData = pos.poolAddress
    ? await db
        .select()
        .from(pool)
        .where(eq(pool.address, pos.poolAddress))
        .limit(1)
    : [];

  // Get token0 data
  const token0Data =
    poolData.length > 0 && poolData[0].token0
      ? await db
          .select()
          .from(token)
          .where(eq(token.address, poolData[0].token0))
          .limit(1)
      : [];

  // Get token1 data
  const token1Data =
    poolData.length > 0 && poolData[0].token1
      ? await db
          .select()
          .from(token)
          .where(eq(token.address, poolData[0].token1))
          .limit(1)
      : [];

  const poolInfo = poolData[0];
  const token0Info = token0Data[0];
  const token1Info = token1Data[0];

  // Use indexed values (note: these may be stale, live data comes from REST API)
  const tickLower = pos.tickLower?.toString() || "0";
  const tickUpper = pos.tickUpper?.toString() || "0";
  const amount0 = pos.amount0?.toString() || "0";
  const amount1 = pos.amount1?.toString() || "0";

  // Default status based on indexed data
  const status = "POSITION_STATUS_IN_RANGE";

  return {
    chainId: pos.chainId,
    protocolVersion: "PROTOCOL_VERSION_V3",
    case: "v3Position",
    v3Position: {
      tokenId: pos.tokenId || "0",
      tickLower: tickLower,
      tickUpper: tickUpper,
      liquidity: "0",
      token0: {
        chainId: token0Info?.chainId || pos.chainId,
        address: token0Info?.address || "",
        symbol: token0Info?.symbol || "",
        decimals: token0Info?.decimals || 18,
        name: token0Info?.name || "",
      },
      token1: {
        chainId: token1Info?.chainId || pos.chainId,
        address: token1Info?.address || "",
        symbol: token1Info?.symbol || "",
        decimals: token1Info?.decimals || 18,
        name: token1Info?.name || "",
      },
      feeTier: poolInfo?.fee?.toString() || "3000",
      currentTick: tickLower,
      currentPrice: "0",
      tickSpacing: poolInfo?.tickSpacing?.toString() || "60",
      token0UncollectedFees: "0",
      token1UncollectedFees: "0",
      amount0: amount0,
      amount1: amount1,
      poolId: pos.poolAddress || "",
      currentLiquidity: "0",
      case: "v3Position",
    },
    status: status,
    timestamp: Math.floor(Date.now() / 1000),
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
      ? and(
          eq(position.owner, normalizedAddress),
          inArray(position.chainId, chainIds)
        )
      : eq(position.owner, normalizedAddress);

    const userPositions = await db
      .select()
      .from(position)
      .where(whereClause);

    // Aggregate positions with related data (indexed data only)
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
