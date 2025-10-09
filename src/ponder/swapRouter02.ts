// @ts-ignore
import { ponder } from "ponder:registry";
import { decodeEventLog, decodeFunctionData, getAddress } from "viem";
import { SwapRouter02Abi } from "../../abis/SwapRouter02.js";
import {
  poolActivity,
  poolStat,
  tokenStat,
  transactionSwap,
} from "ponder.schema.js";
import { UniswapV3PoolAbi } from "abis/UniswapV3Pool";
import {
  getTimestamp1hRoundedDown,
  getTimestamp24hRoundedDown,
} from "../utils/timestamps";

const POOL_SWAP_TOPIC =
  "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67";

const TEMPORAL_FRAMES = ["1h", "24h", "all-time"];

const getIdByTemporalFrame = (
  address: string,
  type: string,
  timestamp: bigint
) => {
  switch (type) {
    case "1h":
      return `${getAddress(address)}-1h-${getTimestamp1hRoundedDown(
        timestamp
      )}`;
    case "24h":
      return `${getAddress(address)}-24h-${getTimestamp24hRoundedDown(
        timestamp
      )}`;
    case "all-time":
      return `${getAddress(address)}`;
  }
};

const updateTokenStat = async ({
  context,
  event,
  tokenAddress,
  amount,
}: {
  context: any;
  event: any;
  tokenAddress: string;
  amount: bigint;
}) => {
  TEMPORAL_FRAMES.forEach(async (type) => {
    await context.db
      .insert(tokenStat)
      .values({
        id: getIdByTemporalFrame(tokenAddress, type, event.block.timestamp),
        address: getAddress(tokenAddress),
        timestamp: event.block.timestamp,
        txCount: 1,
        volume: amount,
        type: type,
      })
      .onConflictDoUpdate((row: any) => ({
        txCount: row.txCount + 1,
        volume: row.volume + amount,
      }));
  });
};

const updatePoolStat = async ({
  context,
  event,
  poolAddress,
  amount0,
  amount1,
}: {
  context: any;
  event: any;
  poolAddress: string;
  amount0: bigint;
  amount1: bigint;
}) => {
  TEMPORAL_FRAMES.forEach(async (type) => {
    await context.db
      .insert(poolStat)
      .values({
        id: getIdByTemporalFrame(poolAddress, type, event.block.timestamp),
        poolAddress: getAddress(poolAddress),
        timestamp: event.block.timestamp,
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
  });
};

async function processSwap({
  event,
  context,
  txReceipt,
  calls,
}: {
  event: any;
  context: any;
  txReceipt: any;
  calls: { functionName: string; args: any }[];
}) {
  calls.forEach(async (call) => {
    if (call.functionName === "exactInputSingle") {
      const args = call.args[0];

      await context.db.insert(transactionSwap).values({
        id: `${event.transaction.hash}-${getAddress(args.tokenIn)}-${getAddress(
          args.tokenOut
        )}-${args.amountIn}-${args.amountOutMinimum}-${args.fee}`,
        txHash: event.transaction.hash,
        chainId: 5115,
        blockNumber: event.block.number,
        blockTimestamp: event.block.timestamp,
        from: event.transaction.from,
        to: event.transaction.to,
        tokenIn: getAddress(args.tokenIn),
        tokenOut: getAddress(args.tokenOut),
        amountIn: args.amountIn,
        amountOut: args.amountOutMinimum,
        fee: args.fee,
        methodSignature: call.functionName,
        swapperAddress: getAddress(event.transaction.from),
      });

      await updateTokenStat({
        context,
        event,
        tokenAddress: getAddress(args.tokenIn),
        amount: args.amountIn,
      });

      await updateTokenStat({
        context,
        event,
        tokenAddress: args.tokenOut,
        amount: args.amountOutMinimum,
      });
    }
  });

  txReceipt.logs
    .filter((log: any) => log.topics[0] === POOL_SWAP_TOPIC)
    .forEach(async (log: any) => {
      const poolSwapEventDecoded = decodeEventLog({
        abi: UniswapV3PoolAbi,
        data: log.data,
        topics: log.topics,
      });
      if (poolSwapEventDecoded.eventName !== "Swap") return;

      const swapArgs = poolSwapEventDecoded.args as unknown as {
        sender: string;
        recipient: string;
        amount0: bigint;
        amount1: bigint;
        sqrtPriceX96: bigint;
        liquidity: bigint;
        tick: number;
      };

      await context.db.insert(poolActivity).values({
        id: `${event.transaction.hash}-${log.logIndex}`,
        poolAddress: getAddress(log.address),
        chainId: 5115,
        blockNumber: log.blockNumber,
        blockTimestamp: log.blockTimestamp,
        txHash: log.transactionHash,
        sender: getAddress(swapArgs.sender),
        recipient: getAddress(swapArgs.recipient),
        amount0: swapArgs.amount0,
        amount1: swapArgs.amount1,
        tick: swapArgs.tick,
        liquidity: swapArgs.liquidity,
        sqrtPriceX96: swapArgs.sqrtPriceX96,
      });

      const amount0 =
        swapArgs.amount0 < 0n ? -swapArgs.amount0 : swapArgs.amount0;
      const amount1 =
        swapArgs.amount1 < 0n ? -swapArgs.amount1 : swapArgs.amount1;

      await updatePoolStat({
        context,
        event,
        poolAddress: getAddress(log.address),
        amount0,
        amount1,
      });
    });
}

ponder.on(
  "SwapRouter02.multicall(uint256 deadline, bytes[] data) payable returns (bytes[])",
  async ({ event, context }: { event: any; context: any }) => {
    let txReceipt;
    try {
      txReceipt = await context.client.getTransactionReceipt({
        hash: event.transaction.hash,
      });
    } catch (error) {}

    if (!txReceipt || txReceipt.status !== "success") {
      return; // Do not process the transaction if it failed
    }

    const calls: { functionName: string; args: any }[] = event.args[1].map(
      (callData: string) => {
        try {
          return decodeFunctionData({
            abi: SwapRouter02Abi,
            data: callData as `0x${string}`,
          });
        } catch (error) {
          return null;
        }
      }
    );

    const isSwap = calls.some(
      (operation) => operation?.functionName === "exactInputSingle"
    );
    if (isSwap) {
      return processSwap({ event, context, txReceipt, calls });
    }
  }
);
