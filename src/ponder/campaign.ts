// @ts-ignore
import { ponder } from "ponder:registry";
// @ts-ignore
import { swap, taskCompletion } from "ponder:schema";
import { getAddress, isAddressEqual } from "viem";

// Campaign Configuration - Maps pool addresses to tasks
const CAMPAIGN_POOLS: Record<string, { taskId: number; symbol: string }> = {
  "0x6006797369E2A595D31Df4ab3691044038AAa7FE": { taskId: 1, symbol: "CBTC/NUSD" },
  "0xA69De906B9A830Deb64edB97B2eb0848139306d2": { taskId: 2, symbol: "CBTC/cUSD" },
  "0xD8C7604176475eB8D350bC1EE452dA4442637C09": { taskId: 3, symbol: "CBTC/USDC" },
};

// Campaign Token Addresses
const CAMPAIGN_TOKENS = {
  CBTC: "0x4370e27f7d91d9341bff232d7ee8bdfe3a9933a0",
  NUSD: "0x9b28b690550522608890c3c7e63c0b4a7ebab9aa",
  cUSD: "0x2ffc18ac99d367b70dd922771df8c2074af4ace0",
  USDC: "0x36c16eac6b0ba6c50f494914ff015fca95b7835f"
};

// Utility functions with error handling
function safeGetAddress(address: any): string {
  try {
    if (!address) return "0x0000000000000000000000000000000000000000";
    return getAddress(String(address));
  } catch (error) {
    console.warn(`Invalid address: ${address}`, error);
    return "0x0000000000000000000000000000000000000000";
  }
}

function safeBigInt(value: any): bigint {
  try {
    if (value === null || value === undefined) return BigInt(0);
    return BigInt(String(value));
  } catch (error) {
    console.warn(`Invalid BigInt: ${value}`, error);
    return BigInt(0);
  }
}

function safeNumber(value: any): number {
  try {
    if (value === null || value === undefined) return 0;
    return Number(String(value));
  } catch (error) {
    console.warn(`Invalid Number: ${value}`, error);
    return 0;
  }
}

// Safe campaign processing with comprehensive error handling
async function processCampaignSwap(event: any, context: any, poolAddress: string, taskId: number, symbol: string) {
  try {
    // Extract event data safely
    const txHash = event?.transaction?.hash;
    const recipient = event?.args?.recipient;
    const blockNumber = event?.block?.number;
    const blockTimestamp = event?.block?.timestamp;
    const logIndex = event?.log?.logIndex;

    if (!txHash || !recipient) {
      console.warn(`Missing required data for ${symbol} - skipping campaign processing`);
      return;
    }

    const uniqueId = `${txHash}-${logIndex || 0}`;
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
    });

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

    console.log(`✅ ${symbol} Campaign: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)} completed Task ${taskId}`);

  } catch (error) {
    console.error(`❌ Error processing ${symbol} campaign:`, error);
    // Continue execution - don't throw to prevent system crash
  }
}

// CBTC/NUSD Pool Handler (Task 1)
ponder.on("CBTCNUSDPool_CitreaTestnet:Swap", async ({ event, context }: { event: any; context: any }) => {
  const poolAddress = "0x6006797369E2A595D31Df4ab3691044038AAa7FE";
  const poolInfo = CAMPAIGN_POOLS[poolAddress];

  console.log(`🔵 NUSD Event: ${event.transaction.hash}`);

  if (poolInfo) {
    await processCampaignSwap(event, context, poolAddress, poolInfo.taskId, poolInfo.symbol);
  }
});

// CBTC/cUSD Pool Handler (Task 2)
ponder.on("CBTCcUSDPool_CitreaTestnet:Swap", async ({ event, context }: { event: any; context: any }) => {
  const poolAddress = "0xA69De906B9A830Deb64edB97B2eb0848139306d2";
  const poolInfo = CAMPAIGN_POOLS[poolAddress];

  console.log(`🟡 cUSD Event: ${event.transaction.hash}`);

  if (poolInfo) {
    await processCampaignSwap(event, context, poolAddress, poolInfo.taskId, poolInfo.symbol);
  }
});

// CBTC/USDC Pool Handler (Task 3)
ponder.on("CBTCUSDCPool_CitreaTestnet:Swap", async ({ event, context }: { event: any; context: any }) => {
  const poolAddress = "0xD8C7604176475eB8D350bC1EE452dA4442637C09";
  const poolInfo = CAMPAIGN_POOLS[poolAddress];

  console.log(`🟢 USDC Event: ${event.transaction.hash}`);

  if (poolInfo) {
    await processCampaignSwap(event, context, poolAddress, poolInfo.taskId, poolInfo.symbol);
  }
});
