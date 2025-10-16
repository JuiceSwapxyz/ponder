// @ts-ignore
import { poolStat, pool, token } from "ponder.schema";
import { desc, eq, inArray } from "ponder";
// @ts-ignore
import { db } from "ponder:api";
import { computeTokenStatsByAddress } from "./computeTokenStats";
import { getAddress } from "viem";

export const computePoolStatsV3 = async () => {
  const bestPools = await db
    .select()
    .from(poolStat)
    .where(eq(poolStat.type, "all-time"))
    .orderBy(desc(poolStat.txCount))
    .limit(20);

  const poolAddresses = bestPools.map((ps: any) => ps.poolAddress);
  const poolInfos = await db
    .select()
    .from(pool)
    .where(inArray(pool.address, poolAddresses));

  const poolMap = new Map(
    poolInfos.map((p: any) => [p.address.toLowerCase(), p])
  );

  const uniqueTokenAddresses = Array.from(
    new Set(poolInfos.flatMap((p: any) => [getAddress(p.token0), getAddress(p.token1)]))
  ) as string[];

  const tokens = await db
    .select()
    .from(token)
    .where(inArray(token.address, uniqueTokenAddresses as any));

  const tokenMap: Map<string, any> = new Map(
    tokens.map((t: any) => [t.address.toLowerCase(), t])
  );

  const formattedBestPools = await Promise.all(
    bestPools.map(async (poolStat: any) => {
      const poolInfo: any = poolMap.get(poolStat.poolAddress.toLowerCase());

      if (!poolInfo) {
        return null;
      }

      const token0DataWithMock = await computeTokenStatsByAddress(
        poolInfo.token0,
        tokenMap
      );
      const token1DataWithMock = await computeTokenStatsByAddress(
        poolInfo.token1,
        tokenMap
      );

      return {
        ...poolStat,
        timestamp: poolStat.timestamp.toString(),
        txCount: poolStat.txCount.toString(),
        volume0: poolStat.volume0.toString(),
        volume1: poolStat.volume1.toString(),
        feeTier: poolInfo.fee.toString(),
        token0: token0DataWithMock,
        token1: token1DataWithMock,
        chain: "CITREA_TESTNET",
        protocolVersion: "V3",
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

  return formattedBestPools.filter(Boolean);
};
