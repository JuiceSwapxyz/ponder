// @ts-ignore
import { getIdByTemporalFrame, TEMPORAL_FRAMES } from "@/utils/timestamps";
import {
  blockProgress,
  pool,
  poolActivity,
  poolStat,
  swap,
  taskCompletion,
  tokenStat,
  transactionSwap,
} from "ponder.schema";

// @ts-ignore
import { ponder } from "ponder:registry";
import { getAddress } from "viem";
import { CAMPAIGN_POOLS, safeBigInt } from "@/utils/campaign";
import { safeGetAddress } from "@/utils/helpers";

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
          chainId: 5115,
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
          chainId: 5115,
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
    try {
      if (!event.transaction) {
        console.warn("Missing transaction data for Swap event, skipping");
        return;
      }

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
      }).onConflictDoNothing();

      await updatePoolStat({
        context,
        timestamp: event.block.timestamp,
        poolAddress: getAddress(event.log.address),
        amount0: abs(event.args.amount0),
        amount1: abs(event.args.amount1),
      });

      const poolInfo = await context.db.find(pool, { id: getAddress(event.log.address) })
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
          id: event.id,
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
        }).onConflictDoNothing();

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

      // Update block progress
      const lastUpdatedAt = BigInt(Math.floor(Date.now() / 1000));
      await context.db
        .insert(blockProgress)
        .values({
          id: `blockProgress`,
          chainId: 5115,
          blockNumber: event.block.number,
          blockTimestamp: event.block.timestamp,
          lastUpdatedAt,
        })
        .onConflictDoUpdate(() => ({
          blockNumber: event.block.number,
          blockTimestamp: event.block.timestamp,
          lastUpdatedAt,
        }));


      const txHash = event?.transaction?.hash;
      const recipient = event?.args?.recipient;
      const blockNumber = event?.block?.number;
      const blockTimestamp = event?.block?.timestamp;

      if (!txHash || !recipient || !event?.id) {
        return;
      }

      const uniqueId = event.id;
      const walletAddress = safeGetAddress(recipient);
      const chainId = 5115;

      // Determine token flow and amounts safely
      const amount0 = safeBigInt(event?.args?.amount0);
      const amount1 = safeBigInt(event?.args?.amount1);

      // UniswapV3 logic: negative amount = token going out, positive = token coming in
      const amountIn = amount0 < BigInt(0) ? -amount0 : amount0;
      const amountOut = amount1 > BigInt(0) ? amount1 : -amount1;

      const campaignPoolInfo = CAMPAIGN_POOLS[getAddress(event.log.address).toLowerCase()];
      // Store swap record with defensive values
      await context.db.insert(swap).values({
        id: uniqueId,
        txHash: txHash,
        chainId: chainId,
        blockNumber: safeBigInt(blockNumber),
        blockTimestamp: safeBigInt(blockTimestamp),
        from: safeGetAddress(event?.args?.sender),
        to: walletAddress,
        tokenIn: safeGetAddress(event?.log?.address),
        tokenOut: safeGetAddress(event?.log?.address),
        amountIn: amountIn,
        amountOut: amountOut,
        router: safeGetAddress(event?.transaction?.to),
        methodSignature: String(event?.transaction?.input || "0x").slice(0, 10),
        isCampaignRelevant: Boolean(campaignPoolInfo),
        campaignTaskId: campaignPoolInfo?.taskId,
      }).onConflictDoNothing();

      // Record task completion (prevent duplicates)
      if (campaignPoolInfo) {
        const completionId = `${chainId}:${walletAddress.toLowerCase()}:${campaignPoolInfo?.taskId}`;
        await context.db.insert(taskCompletion).values({
          id: completionId,
          walletAddress: walletAddress,
          chainId: chainId,
          taskId: campaignPoolInfo?.taskId,
          txHash: txHash,
          completedAt: safeBigInt(blockTimestamp),
          swapAmount: amountOut,
          inputToken: safeGetAddress(event?.log?.address),
          outputToken: safeGetAddress(event?.log?.address),
          blockNumber: safeBigInt(blockNumber),
        }).onConflictDoNothing();
      }



    } catch (error) {
      console.error("Error processing Swap event:", error);
      // Don't rethrow to prevent Ponder's error formatter from accessing null transaction
    }
  }
);
