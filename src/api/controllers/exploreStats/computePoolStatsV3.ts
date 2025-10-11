// @ts-ignore
import { poolStat, pool } from "ponder.schema";
import { desc, eq } from "ponder";
// @ts-ignore
import { db } from "ponder:api";
import { computeTokenStatsByAddress } from "./computeTokenStats";



export const computePoolStatsV3 = async () => {
    const bestPools = await db.select().from(poolStat).where(eq(poolStat.type, "all-time")).orderBy(desc(poolStat.txCount)).limit(20);

    const formattedBestPools = bestPools.map(async (poolStat: any) => {
        const poolInfo = await db.select().from(pool).where(eq(pool.address, poolStat.poolAddress));
        const token0DataWithMock = await computeTokenStatsByAddress(poolInfo[0].token0);
        const token1DataWithMock = await computeTokenStatsByAddress(poolInfo[0].token1);


      return {
        ...poolStat,
        timestamp: poolStat.timestamp.toString(),
        txCount: poolStat.txCount.toString(),
        volume0: poolStat.volume0.toString(),
        volume1: poolStat.volume1.toString(),
        feeTier: poolInfo[0].fee.toString(),
        token0: token0DataWithMock,
        token1: token1DataWithMock,
        "chain": "CITREA_TESTNET",
        "protocolVersion": "V3",
        "totalLiquidity": {
            "value": 0
        },
        "volume1Day": {
            "value": 0
        },
        "volume1Week": {
            "value": 0
        },
        "volume30Day": {
            "value": 0
        },
      };
    });
    

    return Promise.all(formattedBestPools);
};
