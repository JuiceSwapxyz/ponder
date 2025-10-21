// @ts-ignore
import { swap, taskCompletion } from "ponder:schema";
import { getAddress } from "viem";

// Campaign Configuration - Maps pool addresses to tasks
export const CAMPAIGN_POOLS: Record<string, { taskId: number; symbol: string }> = {
  ["0x6006797369E2A595D31Df4ab3691044038AAa7FE".toLowerCase()]: { taskId: 1, symbol: "CBTC/NUSD" },
  ["0xA69De906B9A830Deb64edB97B2eb0848139306d2".toLowerCase()]: { taskId: 2, symbol: "CBTC/cUSD" },
  ["0xD8C7604176475eB8D350bC1EE452dA4442637C09".toLowerCase()]: { taskId: 3, symbol: "CBTC/USDC" },
};

// Utility functions with error handling
export function safeGetAddress(address: any): string {
  try {
    if (!address) return "0x0000000000000000000000000000000000000000";
    return getAddress(String(address));
  } catch (error) {
    console.warn(`Invalid address: ${address}`, error);
    return "0x0000000000000000000000000000000000000000";
  }
}

export function safeBigInt(value: any): bigint {
  try {
    if (value === null || value === undefined) return BigInt(0);
    return BigInt(String(value));
  } catch (error) {
    console.warn(`Invalid BigInt: ${value}`, error);
    return BigInt(0);
  }
}

// Safe campaign processing with comprehensive error handling
export async function processCampaignSwap(event: any, context: any, poolAddress: string, taskId: number, symbol: string) {
  try {
    // Guard against missing transaction data
    if (!event.transaction) {
      console.warn(`Missing transaction data for ${symbol} - skipping campaign processing`);
      return;
    }

    // Extract event data safely
    const txHash = event?.transaction?.hash;
    const recipient = event?.args?.recipient;
    const blockNumber = event?.block?.number;
    const blockTimestamp = event?.block?.timestamp;

    if (!txHash || !recipient || !event?.id) {
      console.warn(`Missing required data for ${symbol} - skipping campaign processing`);
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

    // Store swap record with defensive values
    await context.db.insert(swap).values({
      id: uniqueId,
      txHash: txHash,
      chainId: chainId,
      blockNumber: safeBigInt(blockNumber),
      blockTimestamp: safeBigInt(blockTimestamp),
      from: safeGetAddress(event?.args?.sender),
      to: walletAddress,
      tokenIn: safeGetAddress(poolAddress), // Pool address as proxy for token pair
      tokenOut: safeGetAddress(poolAddress),
      amountIn: amountIn,
      amountOut: amountOut,
      router: safeGetAddress(event?.transaction?.to),
      methodSignature: String(event?.transaction?.input || "0x").slice(0, 10),
      isCampaignRelevant: true,
      campaignTaskId: taskId,
    }).onConflictDoNothing();

    // Record task completion (prevent duplicates)
    const completionId = `${chainId}:${walletAddress.toLowerCase()}:${taskId}`;
    await context.db.insert(taskCompletion).values({
      id: completionId,
      walletAddress: walletAddress,
      chainId: chainId,
      taskId: taskId,
      txHash: txHash,
      completedAt: safeBigInt(blockTimestamp),
      swapAmount: amountOut,
      inputToken: safeGetAddress(poolAddress),
      outputToken: safeGetAddress(poolAddress),
      blockNumber: safeBigInt(blockNumber),
    }).onConflictDoNothing();

  } catch (error) {
    console.error(`❌ Error processing ${symbol} campaign:`, error);
  }
}