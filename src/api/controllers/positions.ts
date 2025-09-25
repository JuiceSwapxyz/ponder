import { Hono, Context } from "hono";
// @ts-ignore
import { db } from "ponder:api";
// @ts-ignore
import { position, pool, token, Position } from "ponder:schema";
import { eq, and } from "drizzle-orm";
import { getAddress } from "viem";

const positions = new Hono();

// Get all positions for a specific owner
positions.post("/owner", async (c: Context) => {
  try {
    const body = await c.req.json();
    const ownerAddress = body.address;

    if (!ownerAddress) {
      return c.json({ error: "Owner address is required" }, 400);
    }

    const normalizedAddress = getAddress(ownerAddress);

    const userPositions = await db
      .select()
      .from(position)
      .where(eq(position.owner, normalizedAddress));

    // Aggregate positions with related data
    const aggregatedPositions = await Promise.all(
      userPositions.map(async (pos: Position) => {
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
          chainId: 5115,
          protocolVersion: "PROTOCOL_VERSION_V3",
          case: 'v3Position',
          v3Position: {
            tokenId: pos.tokenId || "0",
            tickLower: pos.tickLower?.toString() || "-887220",
            tickUpper: pos.tickUpper?.toString() || "887220",
            liquidity: "37945455597966861", // Hardcoded as per requirement
            token0: {
              chainId: 5115,
              address: token0Info?.address || "0x131a8656275bDd1130E0213414F3DA47C8C2a402",
              symbol: token0Info?.symbol || "DNN7",
              decimals: token0Info?.decimals || 18,
              name: token0Info?.name || "DnnToken6"
            },
            token1: {
              chainId: 5115,
              address: token1Info?.address || "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
              symbol: token1Info?.symbol || "WETH",
              decimals: token1Info?.decimals || 18,
              name: token1Info?.name || "Wrapped Ether"
            },
            feeTier: poolInfo?.fee?.toString() || "3000",
            currentTick: "-115136", // Hardcoded as per requirement
            currentPrice: "250529060232794967902094762", // Hardcoded as per requirement
            tickSpacing: poolInfo?.tickSpacing?.toString() || "60",
            token0UncollectedFees: "0", // Hardcoded as per requirement
            token1UncollectedFees: "0", // Hardcoded as per requirement
            amount0: pos.amount0?.toString() || "0", // Hardcoded as per requirement
            amount1: pos.amount1?.toString() || "0", // Hardcoded as per requirement
            poolId: pos.poolAddress || "0xDb2d6eb17997F45BD32904798774b7ea654F3223",
            totalLiquidityUsd: "5.265636176503667857671428106519472", // Hardcoded as per requirement
            currentLiquidity: "104350002894409105", // Hardcoded as per requirement
            case: 'v3Position',
          },
          status: "POSITION_STATUS_IN_RANGE", // Hardcoded as per requirement
          timestamp: Math.floor(Date.now() / 1000) // Current timestamp
        };
      })
    );

    return c.json({
      positions: aggregatedPositions,
    });
  } catch (error) {
    console.error("Get positions by owner error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Get specific position by token ID
positions.get("/:tokenId", async (c: Context) => {
  try {
    const tokenId = c.req.param("tokenId");

    if (!tokenId) {
      return c.json({ error: "Token ID is required" }, 400);
    }

    const positionData = await db
      .select()
      .from(position)
      .where(eq(position.tokenId, tokenId))
      .limit(1);

    if (positionData.length === 0) {
      return c.json({ error: "Position not found" }, 404);
    }

    return c.json(positionData[0]);
  } catch (error) {
    console.error("Get position by token ID error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Get positions by pool address
positions.get("/pool/:poolAddress", async (c: Context) => {
  try {
    const poolAddress = c.req.param("poolAddress");

    if (!poolAddress) {
      return c.json({ error: "Pool address is required" }, 400);
    }

    const normalizedPoolAddress = poolAddress.toLowerCase();

    const poolPositions = await db
      .select()
      .from(position)
      .where(eq(position.poolAddress, normalizedPoolAddress));

    return c.json({
      poolAddress: poolAddress,
      positions: poolPositions,
      count: poolPositions.length,
    });
  } catch (error) {
    console.error("Get positions by pool error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default positions;
