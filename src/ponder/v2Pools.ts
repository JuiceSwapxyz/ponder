/**
 * V2 Pair swap event handler - indexes Swap events from graduated V2 pools
 * Updates v2PoolStat for volume tracking across temporal frames
 */
// @ts-ignore
import { getIdByTemporalFrame, TEMPORAL_FRAMES } from "@/utils/timestamps";
import { graduatedV2Pool, launchpadToken, transactionSwap, v2PoolStat } from "ponder.schema";
// @ts-ignore
import { safeBigInt } from "@/utils/helpers";
// @ts-ignore
import { ponder } from "ponder:registry";
import { getAddress } from "viem";
// @ts-ignore
import { isJuiceSwapRouter } from "@/utils/pointsWhitelist";

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

      // JUICE POINTS: write a transactionSwap row when (a) the tx originates
      // from a JuiceSwap router/gateway and (b) the V2 pair belongs to a
      // graduated launchpad token (so we know its token0/token1). Pre-launchpad
      // V2 pairs that the launchpad never registered are skipped here — they
      // have no `graduatedV2Pool` row and we cannot identify a swapper without
      // ambiguity for V2 (sender == router in most flows). The `from` field on
      // the TX is the user's EOA, which is what we want for point credit.
      if (
        event.transaction &&
        isJuiceSwapRouter(chainId, event.transaction.to)
      ) {
        const graduated = await context.db.find(graduatedV2Pool, { id: poolAddress });
        if (graduated) {
          // Determine which side was taken IN (the trader sent it) vs OUT.
          const tokenInIsToken0 = abs(event.args.amount0In) > 0n;
          const amountIn = tokenInIsToken0
            ? abs(event.args.amount0In)
            : abs(event.args.amount1In);
          const amountOut = tokenInIsToken0
            ? abs(event.args.amount1Out)
            : abs(event.args.amount0Out);
          const tokenIn = tokenInIsToken0 ? graduated.token0 : graduated.token1;
          const tokenOut = tokenInIsToken0 ? graduated.token1 : graduated.token0;

          await context.db
            .insert(transactionSwap)
            .values({
              id: event.id,
              txHash: event.transaction.hash,
              chainId,
              blockNumber: event.block.number,
              blockTimestamp: event.block.timestamp,
              from: event.transaction.from,
              to: event.transaction.to,
              tokenIn: getAddress(tokenIn),
              tokenOut: getAddress(tokenOut),
              amountIn,
              amountOut,
              swapperAddress: getAddress(event.transaction.from),
            })
            .onConflictDoNothing();
        }
      }

      // Check if this pool is a graduated launchpad token
      const pool = await context.db.find(graduatedV2Pool, { id: poolAddress });
      if (pool) {
        // Increment totalSwaps on the graduatedV2Pool record
        await context.db
          .update(graduatedV2Pool, { id: poolAddress })
          .set((row: any) => ({
            totalSwaps: row.totalSwaps + 1,
          }));

        // Update launchpad token volume & trade counters
        const isToken0Base = pool.token0.toLowerCase() !== pool.launchpadTokenAddress.toLowerCase();
        const baseVolume = isToken0Base ? volume0 : volume1;

        // Buy = base asset flows IN (trader sends base, receives token)
        // Sell = base asset flows OUT (trader sends token, receives base)
        const baseIn = isToken0Base ? abs(event.args.amount0In) : abs(event.args.amount1In);
        const isBuy = baseIn > 0n;

        await context.db
          .update(launchpadToken, { id: pool.launchpadTokenAddress })
          .set((row: any) => ({
            totalBuys: isBuy ? row.totalBuys + 1 : row.totalBuys,
            totalSells: isBuy ? row.totalSells : row.totalSells + 1,
            totalVolumeBase: row.totalVolumeBase + baseVolume,
            lastTradeAt: safeBigInt(event.block.timestamp),
          }));
      }
    } catch (error) {
      console.error("[V2Pools] Error processing Swap event:", error);
    }
  },
);
