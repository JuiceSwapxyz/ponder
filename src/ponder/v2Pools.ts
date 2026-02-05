/**
 * V2 Pair swap event handler - indexes Swap events from graduated V2 pools
 * Updates v2PoolStat for volume tracking across temporal frames
 */
// @ts-ignore
import { getIdByTemporalFrame, TEMPORAL_FRAMES } from "@/utils/timestamps";
import { v2PoolStat, graduatedV2Pool } from "ponder.schema";
// @ts-ignore
import { ponder } from "ponder:registry";
import { getAddress } from "viem";

const abs = (n: bigint) => (n < 0n ? -n : n);

const updateV2PoolStat = async ({
  context,
  timestamp,
  poolAddress,
  amount0,
  amount1,
  chainId,
}: {
  context: any;
  timestamp: bigint;
  poolAddress: string;
  amount0: bigint;
  amount1: bigint;
  chainId: number;
}) => {
  await Promise.all(
    TEMPORAL_FRAMES.map(async (type: string) => {
      return context.db
        .insert(v2PoolStat)
        .values({
          id: getIdByTemporalFrame(poolAddress, type, timestamp),
          chainId,
          poolAddress: getAddress(poolAddress),
          timestamp: timestamp,
          txCount: 1,
          volume0: amount0,
          volume1: amount1,
          type: type,
        })
        .onConflictDoUpdate((row: any) => ({
          txCount: row.txCount + 1,
          volume0: row.volume0 + amount0,
          volume1: row.volume1 + amount1,
        }));
    }),
  );
};

ponder.on(
  "UniswapV2Pair:Swap",
  async ({ event, context }: { event: any; context: any }) => {
    try {
      const chainId = context.chain.id;

      if (!event.transaction) {
        console.warn("[V2Pools] Missing transaction data for Swap event, skipping");
        return;
      }

      const poolAddress = getAddress(event.log.address);

      // Volume is the sum of in + out amounts for each token
      const volume0 = abs(event.args.amount0In) + abs(event.args.amount0Out);
      const volume1 = abs(event.args.amount1In) + abs(event.args.amount1Out);

      await updateV2PoolStat({
        context,
        timestamp: event.block.timestamp,
        poolAddress,
        amount0: volume0,
        amount1: volume1,
        chainId,
      });

      // Increment totalSwaps on the graduatedV2Pool record
      try {
        await context.db
          .update(graduatedV2Pool, { id: poolAddress })
          .set((row: any) => ({
            totalSwaps: row.totalSwaps + 1,
          }));
      } catch {
        // Pool may not exist in graduatedV2Pool table (e.g., non-launchpad V2 pools)
      }
    } catch (error) {
      console.error("[V2Pools] Error processing Swap event:", error);
    }
  },
);
