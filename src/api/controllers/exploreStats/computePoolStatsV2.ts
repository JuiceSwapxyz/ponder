// @ts-ignore
import { graduatedV2Pool, token } from "ponder.schema";
import { desc, inArray, eq, and } from "ponder";
// @ts-ignore
import { db } from "ponder:api";
import { computeTokenStatsByAddress, getChainName } from "./computeTokenStats";
import { getAddress } from "viem";

export const computePoolStatsV2 = async (chainId: number = 5115) => {
  const chainName = getChainName(chainId);

  // Get graduated V2 pools ordered by total swaps
  const v2Pools = await db
    .select()
    .from(graduatedV2Pool)
    .where(eq(graduatedV2Pool.chainId, chainId))
    .orderBy(desc(graduatedV2Pool.totalSwaps))
    .limit(20);

  if (v2Pools.length === 0) {
    return [];
  }

  // Get unique token addresses from all pools
  const uniqueTokenAddresses = Array.from(
    new Set(v2Pools.flatMap((p: any) => [getAddress(p.token0), getAddress(p.token1)]))
  ) as string[];

  // Fetch token data
  const tokens = await db
    .select()
    .from(token)
    .where(and(inArray(token.address, uniqueTokenAddresses as any), eq(token.chainId, chainId)));

  const tokenMap: Map<string, any> = new Map(
    tokens.map((t: any) => [t.address.toLowerCase(), t])
  );

  // Format pools with token data
  // Note: Reserves are returned as "0" - the API layer fetches fresh on-chain reserves if needed
  const formattedPools = await Promise.all(
    v2Pools.map(async (pool: any) => {
      const [token0DataWithMock, token1DataWithMock] = await Promise.all([
        computeTokenStatsByAddress(pool.token0, tokenMap, chainId),
        computeTokenStatsByAddress(pool.token1, tokenMap, chainId),
      ]);

      return {
        poolAddress: pool.pairAddress,
        timestamp: pool.createdAt.toString(),
        txCount: pool.totalSwaps.toString(),
        reserve0: "0",
        reserve1: "0",
        feeTier: "3000", // V2 pools have 0.3% fee (3000 basis points)
        token0: token0DataWithMock,
        token1: token1DataWithMock,
        chain: chainName,
        protocolVersion: "V2",
        totalLiquidity: {
          value: 0,
        },
        volume1Day: {
          value: 0,
        },
        volume1Week: {
          value: 0,
        },
        volume30Day: {
          value: 0,
        },
      };
    })
  );

  return formattedPools.filter(Boolean);
};
