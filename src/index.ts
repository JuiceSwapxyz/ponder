import { ponder } from "ponder:registry";
import {
  swap,
  campaignProgress,
  taskCompletion,
  campaignStats,
  token
} from "ponder:schema";
import { getAddress, isAddressEqual, Address, Hash } from "viem";

// Track processed transactions to avoid duplicates
const processedTxns = new Set<string>();

// Multi-Chain Campaign Pool Mapping - Maps pool addresses to campaign tasks
const CAMPAIGN_POOLS: Record<number, Record<string, { taskId: number; symbol: string }>> = {
  // Citrea Testnet - UniswapV3 Pools for Citrea bApps Campaign
  5115: {
    "0x6006797369E2A595D31Df4ab3691044038AAa7FE": { taskId: 1, symbol: "CBTC/NUSD" },
    "0xA69De906B9A830Deb64edB97B2eb0848139306d2": { taskId: 2, symbol: "CBTC/cUSD" },
    "0xD8C7604176475eB8D350bC1EE452dA4442637C09": { taskId: 3, symbol: "CBTC/USDC" },
  },
  // Citrea Mainnet (TODO: Add actual mainnet pool addresses)
  62298: {},
  // Ethereum Mainnet (TODO: Add actual mainnet pool addresses)
  1: {},
  // Sepolia Testnet (TODO: Add actual testnet pool addresses)
  11155111: {}
};

// Expected Swap event signature
const SWAP_EVENT_SIGNATURE = "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67";

// ========================================
// CITREA TESTNET - UNISWAP V3 POOL SWAP EVENT HANDLERS
// ========================================

// CBTC/NUSD Pool Swap Handler (Task 1)
ponder.on("CBTCNUSDPool_CitreaTestnet:Swap", async ({ event, context }) => {
  // Skip if we've already processed this transaction
  if (processedTxns.has(event.transaction.hash)) {
    return;
  }

  try {
    processedTxns.add(event.transaction.hash);

    // Create swap data from the Swap event
    const swapData = {
      txHash: String(event.transaction.hash),
      chainId: Number(5115),
      blockNumber: BigInt(event.block.number),
      blockTimestamp: BigInt(event.block.timestamp),
      poolAddress: getAddress(String(event.log.address)),
      sender: getAddress(String(event.args.sender)),
      recipient: getAddress(String(event.args.recipient)),
      amount0: BigInt(String(event.args.amount0)),
      amount1: BigInt(String(event.args.amount1)),
      sqrtPriceX96: BigInt(String(event.args.sqrtPriceX96)),
      liquidity: BigInt(String(event.args.liquidity)),
      tick: Number(String(event.args.tick)),
      router: event.transaction.to ? getAddress(String(event.transaction.to)) : getAddress(String(event.args.sender)),
      methodSignature: String(event.transaction.input).slice(0, 10),
    };

    // Get campaign pool info
    const campaignPool = CAMPAIGN_POOLS[swapData.chainId]?.[swapData.poolAddress.toLowerCase()];
    const isCampaignRelevant = !!campaignPool && campaignPool.taskId === 1;

    // Determine amounts for storage (use absolute values)
    const amountIn = swapData.amount0 < BigInt(0) ? -swapData.amount0 : swapData.amount0;
    const amountOut = swapData.amount1 > BigInt(0) ? swapData.amount1 : -swapData.amount1;

    // Store swap record
    await context.db.insert(swap).values({
      id: String(swapData.txHash),
      txHash: String(swapData.txHash),
      chainId: Number(swapData.chainId),
      blockNumber: BigInt(String(swapData.blockNumber)),
      blockTimestamp: BigInt(String(swapData.blockTimestamp)),
      from: String(swapData.sender),
      to: String(swapData.recipient),
      tokenIn: String(swapData.poolAddress),
      tokenOut: String(swapData.poolAddress),
      amountIn: BigInt(String(amountIn)),
      amountOut: BigInt(String(amountOut)),
      router: String(swapData.router),
      methodSignature: String(swapData.methodSignature),
      isCampaignRelevant: Boolean(isCampaignRelevant),
      campaignTaskId: campaignPool?.taskId ? Number(campaignPool.taskId) : null,
    });

    // If campaign relevant, process task completion
    if (isCampaignRelevant && campaignPool) {
      const progressId = `${swapData.chainId}:${swapData.recipient.toLowerCase()}`;
      const completionId = `${swapData.chainId}:${swapData.recipient.toLowerCase()}:${1}`;

      // Ensure campaign progress exists
      await context.db.insert(campaignProgress).values({
        id: progressId,
        walletAddress: swapData.recipient,
        chainId: swapData.chainId,
        createdAt: swapData.blockTimestamp,
        updatedAt: swapData.blockTimestamp,
      }).onConflictDoUpdate((row) => ({
        updatedAt: swapData.blockTimestamp,
      }));

      // Record task completion
      await context.db.insert(taskCompletion).values({
        id: completionId,
        walletAddress: swapData.recipient,
        chainId: swapData.chainId,
        taskId: 1,
        txHash: swapData.txHash,
        completedAt: swapData.blockTimestamp,
        swapAmount: amountOut,
        inputToken: swapData.poolAddress,
        outputToken: swapData.poolAddress,
        blockNumber: swapData.blockNumber,
      }).onConflictDoNothing();
    }

    console.log(`✅ Processed CBTC/NUSD swap: ${swapData.txHash}`);
  } catch (error) {
    console.error("Error processing CBTC/NUSD pool swap:", error);
  }
});

// CBTC/cUSD Pool Swap Handler (Task 2)
ponder.on("CBTCcUSDPool_CitreaTestnet:Swap", async ({ event, context }) => {
  // Skip if we've already processed this transaction
  if (processedTxns.has(event.transaction.hash)) {
    return;
  }

  try {
    processedTxns.add(event.transaction.hash);

    // Create swap data from the Swap event
    const swapData = {
      txHash: String(event.transaction.hash),
      chainId: Number(5115),
      blockNumber: BigInt(event.block.number),
      blockTimestamp: BigInt(event.block.timestamp),
      poolAddress: getAddress(String(event.log.address)),
      sender: getAddress(String(event.args.sender)),
      recipient: getAddress(String(event.args.recipient)),
      amount0: BigInt(String(event.args.amount0)),
      amount1: BigInt(String(event.args.amount1)),
      sqrtPriceX96: BigInt(String(event.args.sqrtPriceX96)),
      liquidity: BigInt(String(event.args.liquidity)),
      tick: Number(String(event.args.tick)),
      router: event.transaction.to ? getAddress(String(event.transaction.to)) : getAddress(String(event.args.sender)),
      methodSignature: String(event.transaction.input).slice(0, 10),
    };

    // Get campaign pool info
    const campaignPool = CAMPAIGN_POOLS[swapData.chainId]?.[swapData.poolAddress.toLowerCase()];
    const isCampaignRelevant = !!campaignPool && campaignPool.taskId === 2;

    // Determine amounts for storage (use absolute values)
    const amountIn = swapData.amount0 < BigInt(0) ? -swapData.amount0 : swapData.amount0;
    const amountOut = swapData.amount1 > BigInt(0) ? swapData.amount1 : -swapData.amount1;

    // Store swap record
    await context.db.insert(swap).values({
      id: String(swapData.txHash),
      txHash: String(swapData.txHash),
      chainId: Number(swapData.chainId),
      blockNumber: BigInt(String(swapData.blockNumber)),
      blockTimestamp: BigInt(String(swapData.blockTimestamp)),
      from: String(swapData.sender),
      to: String(swapData.recipient),
      tokenIn: String(swapData.poolAddress),
      tokenOut: String(swapData.poolAddress),
      amountIn: BigInt(String(amountIn)),
      amountOut: BigInt(String(amountOut)),
      router: String(swapData.router),
      methodSignature: String(swapData.methodSignature),
      isCampaignRelevant: Boolean(isCampaignRelevant),
      campaignTaskId: campaignPool?.taskId ? Number(campaignPool.taskId) : null,
    });

    // If campaign relevant, process task completion
    if (isCampaignRelevant && campaignPool) {
      const progressId = `${swapData.chainId}:${swapData.recipient.toLowerCase()}`;
      const completionId = `${swapData.chainId}:${swapData.recipient.toLowerCase()}:${2}`;

      // Ensure campaign progress exists
      await context.db.insert(campaignProgress).values({
        id: progressId,
        walletAddress: swapData.recipient,
        chainId: swapData.chainId,
        createdAt: swapData.blockTimestamp,
        updatedAt: swapData.blockTimestamp,
      }).onConflictDoUpdate((row) => ({
        updatedAt: swapData.blockTimestamp,
      }));

      // Record task completion
      await context.db.insert(taskCompletion).values({
        id: completionId,
        walletAddress: swapData.recipient,
        chainId: swapData.chainId,
        taskId: 2,
        txHash: swapData.txHash,
        completedAt: swapData.blockTimestamp,
        swapAmount: amountOut,
        inputToken: swapData.poolAddress,
        outputToken: swapData.poolAddress,
        blockNumber: swapData.blockNumber,
      }).onConflictDoNothing();
    }

    console.log(`✅ Processed CBTC/cUSD swap: ${swapData.txHash}`);
  } catch (error) {
    console.error("Error processing CBTC/cUSD pool swap:", error);
  }
});

// CBTC/USDC Pool Swap Handler (Task 3)
ponder.on("CBTCUSDCPool_CitreaTestnet:Swap", async ({ event, context }) => {
  // Skip if we've already processed this transaction
  if (processedTxns.has(event.transaction.hash)) {
    return;
  }

  try {
    processedTxns.add(event.transaction.hash);

    // Create swap data from the Swap event
    const swapData = {
      txHash: String(event.transaction.hash),
      chainId: Number(5115),
      blockNumber: BigInt(event.block.number),
      blockTimestamp: BigInt(event.block.timestamp),
      poolAddress: getAddress(String(event.log.address)),
      sender: getAddress(String(event.args.sender)),
      recipient: getAddress(String(event.args.recipient)),
      amount0: BigInt(String(event.args.amount0)),
      amount1: BigInt(String(event.args.amount1)),
      sqrtPriceX96: BigInt(String(event.args.sqrtPriceX96)),
      liquidity: BigInt(String(event.args.liquidity)),
      tick: Number(String(event.args.tick)),
      router: event.transaction.to ? getAddress(String(event.transaction.to)) : getAddress(String(event.args.sender)),
      methodSignature: String(event.transaction.input).slice(0, 10),
    };

    // Get campaign pool info
    const campaignPool = CAMPAIGN_POOLS[swapData.chainId]?.[swapData.poolAddress.toLowerCase()];
    const isCampaignRelevant = !!campaignPool && campaignPool.taskId === 3;

    // Determine amounts for storage (use absolute values)
    const amountIn = swapData.amount0 < BigInt(0) ? -swapData.amount0 : swapData.amount0;
    const amountOut = swapData.amount1 > BigInt(0) ? swapData.amount1 : -swapData.amount1;

    // Store swap record
    await context.db.insert(swap).values({
      id: String(swapData.txHash),
      txHash: String(swapData.txHash),
      chainId: Number(swapData.chainId),
      blockNumber: BigInt(String(swapData.blockNumber)),
      blockTimestamp: BigInt(String(swapData.blockTimestamp)),
      from: String(swapData.sender),
      to: String(swapData.recipient),
      tokenIn: String(swapData.poolAddress),
      tokenOut: String(swapData.poolAddress),
      amountIn: BigInt(String(amountIn)),
      amountOut: BigInt(String(amountOut)),
      router: String(swapData.router),
      methodSignature: String(swapData.methodSignature),
      isCampaignRelevant: Boolean(isCampaignRelevant),
      campaignTaskId: campaignPool?.taskId ? Number(campaignPool.taskId) : null,
    });

    // If campaign relevant, process task completion
    if (isCampaignRelevant && campaignPool) {
      const progressId = `${swapData.chainId}:${swapData.recipient.toLowerCase()}`;
      const completionId = `${swapData.chainId}:${swapData.recipient.toLowerCase()}:${3}`;

      // Ensure campaign progress exists
      await context.db.insert(campaignProgress).values({
        id: progressId,
        walletAddress: swapData.recipient,
        chainId: swapData.chainId,
        createdAt: swapData.blockTimestamp,
        updatedAt: swapData.blockTimestamp,
      }).onConflictDoUpdate((row) => ({
        updatedAt: swapData.blockTimestamp,
      }));

      // Record task completion
      await context.db.insert(taskCompletion).values({
        id: completionId,
        walletAddress: swapData.recipient,
        chainId: swapData.chainId,
        taskId: 3,
        txHash: swapData.txHash,
        completedAt: swapData.blockTimestamp,
        swapAmount: amountOut,
        inputToken: swapData.poolAddress,
        outputToken: swapData.poolAddress,
        blockNumber: swapData.blockNumber,
      }).onConflictDoNothing();
    }

    console.log(`✅ Processed CBTC/USDC swap: ${swapData.txHash}`);
  } catch (error) {
    console.error("Error processing CBTC/USDC pool swap:", error);
  }
});