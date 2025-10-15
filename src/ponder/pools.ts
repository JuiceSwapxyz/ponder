// @ts-ignore
import { getIdByTemporalFrame, TEMPORAL_FRAMES } from "@/utils/timestamps";
import {
  pool,
  poolActivity,
  poolStat,
  tokenStat,
  transactionSwap,
} from "ponder.schema";

// @ts-ignore
import { ponder } from "ponder:registry";
import { getAddress } from "viem";
import { eq } from "ponder";

const abs = (n: bigint) => n < 0n ? -n : n;

const updateTokenStat = async ({
  context,
  timestamp,
  tokenAddress,
  amount,
}: {
  context: any;
  timestamp: bigint;
  tokenAddress: string;
  amount: bigint;
}) => {
  await Promise.all(
    TEMPORAL_FRAMES.map(async (type) => {
      return context.db
        .insert(tokenStat)
        .values({
          id: getIdByTemporalFrame(tokenAddress, type, timestamp),
          address: getAddress(tokenAddress),
          timestamp: timestamp,
          txCount: 1,
          volume: amount,
          type: type,
        })
        .onConflictDoUpdate((row: any) => ({
          txCount: row.txCount + 1,
          volume: row.volume + amount,
        }));
    })
  );
};

const updatePoolStat = async ({
  context,
  timestamp,
  poolAddress,
  amount0,
  amount1,
}: {
  context: any;
  timestamp: bigint;
  poolAddress: string;
  amount0: bigint;
  amount1: bigint;
}) => {
  await Promise.all(
    TEMPORAL_FRAMES.map(async (type) => {
      return context.db
        .insert(poolStat)
        .values({
          id: getIdByTemporalFrame(poolAddress, type, timestamp),
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
    })
  );
};

ponder.on(
  "UniswapV3Pool:Swap",
  async ({ event, context }: { event: any; context: any }) => {
    await context.db.insert(poolActivity).values({
      id: event.id,
      poolAddress: getAddress(event.log.address),
      chainId: 5115,
      blockNumber: event.log.blockNumber,
      blockTimestamp: event.block.timestamp,
      txHash: event.transaction.hash,
      sender: getAddress(event.args.sender),
      recipient: getAddress(event.args.recipient),
      amount0: event.args.amount0,
      amount1: event.args.amount1,
      tick: event.args.tick,
      liquidity: event.args.liquidity,
      sqrtPriceX96: event.args.sqrtPriceX96,
    });

    await updatePoolStat({
      context,
      timestamp: event.block.timestamp,
      poolAddress: getAddress(event.log.address),
      amount0: abs(event.args.amount0),
      amount1: abs(event.args.amount1),
    });

    const poolInfo = await context.db.find(pool, { id: getAddress(event.log.address)})
    if (poolInfo) {
      const tokenIn =
        event.args.amount0 > 0n ? poolInfo.token0 : poolInfo.token1;
      const tokenOut =
        event.args.amount0 > 0n ? poolInfo.token1 : poolInfo.token0;

      const amountIn =
        event.args.amount0 > 0n ? event.args.amount0 : event.args.amount1;
      const amountOut =
        event.args.amount1 > 0n ? event.args.amount1 : event.args.amount0;

      await context.db.insert(transactionSwap).values({
        id: `${event.transaction.hash}-${getAddress(tokenIn)}-${getAddress(
          tokenOut
        )}-${amountIn}-${amountOut}`,
        txHash: event.transaction.hash,
        chainId: 5115,
        blockNumber: event.block.number,
        blockTimestamp: event.block.timestamp,
        from: event.transaction.from,
        to: event.transaction.to,
        tokenIn: getAddress(tokenIn),
        tokenOut: getAddress(tokenOut),
        amountIn: amountIn,
        amountOut: amountOut,
        swapperAddress: getAddress(event.transaction.from),
      });

      await updateTokenStat({
        context,
        timestamp: event.block.timestamp,
        tokenAddress: getAddress(tokenIn),
        amount: abs(amountIn),
      });

      await updateTokenStat({
        context,
        timestamp: event.block.timestamp,
        tokenAddress: getAddress(tokenOut),
        amount: abs(amountOut),
      });
    }
  }
);
