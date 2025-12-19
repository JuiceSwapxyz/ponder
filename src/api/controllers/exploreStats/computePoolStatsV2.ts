// @ts-ignore
import { graduatedV2Pool, token } from "ponder.schema";
import { desc, inArray } from "ponder";
// @ts-ignore
import { db } from "ponder:api";
import { computeTokenStatsByAddress } from "./computeTokenStats";
import { getAddress } from "viem";
import { getV2PairReservesMulticall } from "../../utils/citreaClient";

export const computePoolStatsV2 = async () => {
  // Get graduated V2 pools ordered by total swaps
  const v2Pools = await db
    .select()
    .from(graduatedV2Pool)
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
    .where(inArray(token.address, uniqueTokenAddresses as any));

  const tokenMap: Map<string, any> = new Map(
    tokens.map((t: any) => [t.address.toLowerCase(), t])
  );

  // Fetch all reserves in a single multicall
  const pairAddresses = v2Pools.map((p: any) => p.pairAddress);
  const reservesMap = await getV2PairReservesMulticall(pairAddresses);

  // Format pools with token data and on-chain reserves
  const formattedPools = await Promise.all(
    v2Pools.map(async (pool: any) => {
      const [token0DataWithMock, token1DataWithMock] = await Promise.all([
        computeTokenStatsByAddress(pool.token0, tokenMap),
        computeTokenStatsByAddress(pool.token1, tokenMap),
      ]);

      const reserves = reservesMap.get(pool.pairAddress.toLowerCase()) || { reserve0: 0n, reserve1: 0n };

      return {
        poolAddress: pool.pairAddress,
        timestamp: pool.createdAt.toString(),
        txCount: pool.totalSwaps.toString(),
        reserve0: reserves.reserve0.toString(),
        reserve1: reserves.reserve1.toString(),
        feeTier: "3000", // V2 pools have 0.3% fee (3000 basis points)
        token0: token0DataWithMock,
        token1: token1DataWithMock,
        chain: "CITREA_TESTNET",
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
