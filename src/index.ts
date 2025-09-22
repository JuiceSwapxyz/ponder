// @ts-ignore - Generated at build time
import { ponder } from "@/generated";
import { getAddress, isAddressEqual, Address, Hash } from "viem";
import type {
  TransactionEvent,
  TransactionReceipt,
  PonderContext,
  SwapAnalysisResult,
  CampaignToken,
} from "./types";

// Track processed transactions to avoid duplicates
const processedTxns = new Set<string>();

// Multi-Chain Campaign Token Mapping
const CAMPAIGN_TOKENS: Record<number, Record<string, CampaignToken>> = {
  // Citrea Testnet
  5115: {
    "0x9B28B690550522608890C3C7e63c0b4A7eBab9AA": { taskId: 1, symbol: "NUSD" },
    "0x2fFC18aC99D367b70dd922771dF8c2074af4aCE0": { taskId: 2, symbol: "cUSD" },
    "0x36c16eaC6B0Ba6c50f494914ff015fCa95B7835F": { taskId: 3, symbol: "USDC" },
  },
  // Citrea Mainnet (TODO: Add actual mainnet addresses)
  62298: {
    // "0x...": { taskId: 1, symbol: "NUSD" },
    // "0x...": { taskId: 2, symbol: "cUSD" },
    // "0x...": { taskId: 3, symbol: "USDC" },
  },
  // Ethereum Mainnet
  1: {
    "0xA0b86a33E6417C00A2C62cc0ebe71a7C30c7e54D": { taskId: 1, symbol: "USDT" },
    "0xdAC17F958D2ee523a2206206994597C13D831ec7": { taskId: 2, symbol: "USDT" },
    "0xA0b1C33E6417C00A5C62c1c0ebe71a7C30c7e54D": { taskId: 3, symbol: "USDC" },
  },
  // Sepolia Testnet
  11155111: {
    "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9": { taskId: 1, symbol: "WETH" },
    "0xf531B8F309Be94191af87605CfBf600D71C2cFe0": { taskId: 2, symbol: "USDC" },
    "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8": { taskId: 3, symbol: "USDT" },
  }
};

// Multi-Chain Router addresses for validation
const KNOWN_ROUTERS: Record<number, string[]> = {
  // Citrea Testnet
  5115: [
    "0x610c98EAD0df13EA906854b6041122e8A8D14413", // JuiceSwap Router02
    "0xb2A4E33e9A9aC7c46045A2D0318a4F50194dafDE", // JuiceSwap Router
    "0x3012E9049d05B4B5369D690114D5A5861EbB85cb", // JuiceSwap Router Alt
  ],
  // Citrea Mainnet (TODO: Add actual mainnet router addresses)
  62298: [
    // "0x...", // JuiceSwap Router02 Mainnet
    // "0x...", // JuiceSwap Router Mainnet
  ],
  // Ethereum Mainnet
  1: [
    "0xE592427A0AEce92De3Edee1F18E0157C05861564", // Uniswap V3 Router
    "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45", // Uniswap V3 Router 2
    "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", // Uniswap V2 Router
  ],
  // Sepolia Testnet
  11155111: [
    "0xE592427A0AEce92De3Edee1F18E0157C05861564", // Uniswap V3 Router Sepolia
    "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45", // Uniswap V3 Router 2 Sepolia
  ]
};

// Track swap transactions from router calls
// For now, we don't have specific events from the routers
// We'll rely on Transfer events from the tokens to track swaps

// Token Transfer event handlers with swap detection logic
// Since routers don't emit events, we detect swaps from token transfers

// Token Transfer event handlers - Detect and process swaps
ponder.on("NUSD_CitreaTestnet:Transfer", async ({ event, context }) => {
  const { db, block } = context;

  // Check if this transaction involves a known router
  const txTo = event.transaction.to ? getAddress(event.transaction.to) : null;
  const isRouterTx = txTo && KNOWN_ROUTERS[5115]?.some(router => isAddressEqual(txTo, router));

  // Skip if we've already processed this transaction
  if (processedTxns.has(event.transaction.hash)) {
    return;
  }

  // Process if this is a router transaction or if value was sent (native token swap)
  if (isRouterTx || event.transaction.value > 0n) {
    processedTxns.add(event.transaction.hash);
    try {
      // Create simplified swap data from the Transfer event
      const swapData = {
        txHash: event.transaction.hash,
        chainId: 5115,
        blockNumber: BigInt(block.number),
        blockTimestamp: BigInt(block.timestamp),
        from: getAddress(event.transaction.from),
        to: txTo || ("0x0000000000000000000000000000000000000000" as Address),
        tokenIn: event.transaction.value > 0n ? ("0x0000000000000000000000000000000000000000" as Address) : getAddress(event.args.from),
        tokenOut: getAddress(event.log.address),
        amountIn: event.transaction.value > 0n ? event.transaction.value : 0n,
        amountOut: BigInt(event.args.value),
        router: txTo || ("0x0000000000000000000000000000000000000000" as Address),
        methodSignature: event.transaction.input.slice(0, 10),
      };

      // Check if this is a swap to NUSD from native token
      const isCampaignRelevant = event.transaction.value > 0n &&
        CAMPAIGN_TOKENS[5115]?.[event.log.address.toLowerCase()];

      if (isCampaignRelevant) {
        await processSwap(swapData, context);
      }
    } catch (error) {
      console.error("Error processing NUSD transfer:", error);
    }
  }
});

ponder.on("cUSD_CitreaTestnet:Transfer", async ({ event, context }) => {
  const { db, block } = context;

  // Check if this transaction involves a known router
  const txTo = event.transaction.to ? getAddress(event.transaction.to) : null;
  const isRouterTx = txTo && KNOWN_ROUTERS[5115]?.some(router => isAddressEqual(txTo, router));

  // Skip if we've already processed this transaction
  if (processedTxns.has(event.transaction.hash)) {
    return;
  }

  // Process if this is a router transaction or if value was sent (native token swap)
  if (isRouterTx || event.transaction.value > 0n) {
    processedTxns.add(event.transaction.hash);
    try {
      // Create simplified swap data from the Transfer event
      const swapData = {
        txHash: event.transaction.hash,
        chainId: 5115,
        blockNumber: BigInt(block.number),
        blockTimestamp: BigInt(block.timestamp),
        from: getAddress(event.transaction.from),
        to: txTo || ("0x0000000000000000000000000000000000000000" as Address),
        tokenIn: event.transaction.value > 0n ? ("0x0000000000000000000000000000000000000000" as Address) : getAddress(event.args.from),
        tokenOut: getAddress(event.log.address),
        amountIn: event.transaction.value > 0n ? event.transaction.value : 0n,
        amountOut: BigInt(event.args.value),
        router: txTo || ("0x0000000000000000000000000000000000000000" as Address),
        methodSignature: event.transaction.input.slice(0, 10),
      };

      // Check if this is a swap to cUSD from native token
      const isCampaignRelevant = event.transaction.value > 0n &&
        CAMPAIGN_TOKENS[5115]?.[event.log.address.toLowerCase()];

      if (isCampaignRelevant) {
        await processSwap(swapData, context);
      }
    } catch (error) {
      console.error("Error processing cUSD transfer:", error);
    }
  }
});

ponder.on("USDC_CitreaTestnet:Transfer", async ({ event, context }) => {
  const { db, block } = context;

  // Check if this transaction involves a known router
  const txTo = event.transaction.to ? getAddress(event.transaction.to) : null;
  const isRouterTx = txTo && KNOWN_ROUTERS[5115]?.some(router => isAddressEqual(txTo, router));

  // Skip if we've already processed this transaction
  if (processedTxns.has(event.transaction.hash)) {
    return;
  }

  // Process if this is a router transaction or if value was sent (native token swap)
  if (isRouterTx || event.transaction.value > 0n) {
    processedTxns.add(event.transaction.hash);
    try {
      // Create simplified swap data from the Transfer event
      const swapData = {
        txHash: event.transaction.hash,
        chainId: 5115,
        blockNumber: BigInt(block.number),
        blockTimestamp: BigInt(block.timestamp),
        from: getAddress(event.transaction.from),
        to: txTo || ("0x0000000000000000000000000000000000000000" as Address),
        tokenIn: event.transaction.value > 0n ? ("0x0000000000000000000000000000000000000000" as Address) : getAddress(event.args.from),
        tokenOut: getAddress(event.log.address),
        amountIn: event.transaction.value > 0n ? event.transaction.value : 0n,
        amountOut: BigInt(event.args.value),
        router: txTo || ("0x0000000000000000000000000000000000000000" as Address),
        methodSignature: event.transaction.input.slice(0, 10),
      };

      // Check if this is a swap to USDC from native token
      const isCampaignRelevant = event.transaction.value > 0n &&
        CAMPAIGN_TOKENS[5115]?.[event.log.address.toLowerCase()];

      if (isCampaignRelevant) {
        await processSwap(swapData, context);
      }
    } catch (error) {
      console.error("Error processing USDC transfer:", error);
    }
  }
});

// ========================================
// FUTURE: EVENT HANDLERS FOR OTHER CHAINS
// ========================================
// Uncomment and update addresses when deploying to other chains

// CITREA MAINNET HANDLERS (Chain ID: 62298)
// ponder.on("JuiceSwapRouter02_CitreaMainnet:call", async ({ event, context }) => {
//   const { client, db } = context;
//   try {
//     const receipt = await client.getTransactionReceipt({
//       hash: event.transaction.hash
//     });
//     const swapData = await analyzeSwapTransaction(receipt, event, context, 62298);
//     if (swapData) {
//       await processSwap(swapData, context);
//     }
//   } catch (error) {
//     console.error("Error processing Citrea mainnet router call:", error);
//   }
// });

// ETHEREUM MAINNET HANDLERS (Chain ID: 1)
// ponder.on("UniswapV3Router_Ethereum:call", async ({ event, context }) => {
//   const { client, db } = context;
//   try {
//     const receipt = await client.getTransactionReceipt({
//       hash: event.transaction.hash
//     });
//     const swapData = await analyzeSwapTransaction(receipt, event, context, 1);
//     if (swapData) {
//       await processSwap(swapData, context);
//     }
//   } catch (error) {
//     console.error("Error processing Ethereum router call:", error);
//   }
// });

// SEPOLIA TESTNET HANDLERS (Chain ID: 11155111)
// ponder.on("UniswapV3Router_Sepolia:call", async ({ event, context }) => {
//   const { client, db } = context;
//   try {
//     const receipt = await client.getTransactionReceipt({
//       hash: event.transaction.hash
//     });
//     const swapData = await analyzeSwapTransaction(receipt, event, context, 11155111);
//     if (swapData) {
//       await processSwap(swapData, context);
//     }
//   } catch (error) {
//     console.error("Error processing Sepolia router call:", error);
//   }
// });

// Helper Functions
async function analyzeSwapTransaction(
  receipt: any,
  transaction: any,
  context: any,
  chainId: number
): Promise<SwapAnalysisResult | null> {
  const { block } = context;

  // Look for Transfer events in the transaction
  const transferEvents = receipt.logs.filter((log) =>
    log.topics[0] === "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef" // Transfer event signature
  );

  if (transferEvents.length < 2) return null;

  // Analyze transfer pattern to identify swap
  const from = transaction.from;
  let tokenIn: string | null = null;
  let tokenOut: string | null = null;
  let amountIn = 0n;
  let amountOut = 0n;

  // Find input and output tokens from transfers
  for (const transferLog of transferEvents) {
    const tokenAddress = getAddress(transferLog.address);
    const fromAddr = getAddress(`0x${transferLog.topics[1].slice(26)}`);
    const toAddr = getAddress(`0x${transferLog.topics[2].slice(26)}`);
    const amount = BigInt(transferLog.data);

    // Input token: user transfers to router/pool
    if (isAddressEqual(fromAddr, from)) {
      tokenIn = tokenAddress;
      amountIn = amount;
    }

    // Output token: router/pool transfers to user
    if (isAddressEqual(toAddr, from)) {
      tokenOut = tokenAddress;
      amountOut = amount;
    }
  }

  // Check if this involves native token (ETH/cBTC/etc.)
  if (transaction.value > 0n) {
    tokenIn = "0x0000000000000000000000000000000000000000"; // Native token
    amountIn = transaction.value;
  }

  if (!tokenOut) return null;

  return {
    txHash: transaction.hash,
    chainId,
    blockNumber: BigInt(block.number),
    blockTimestamp: BigInt(block.timestamp),
    from: getAddress(from),
    to: getAddress(transaction.to || "0x0"),
    tokenIn: tokenIn ? getAddress(tokenIn) : ("0x0000000000000000000000000000000000000000" as Address),
    tokenOut: getAddress(tokenOut),
    amountIn,
    amountOut,
    router: getAddress(transaction.to || "0x0"),
    methodSignature: transaction.input.slice(0, 10),
  };
}

async function processSwap(swapData: any, context: any): Promise<void> {
  const { db } = context;

  // Check if this is a campaign-relevant swap
  const campaignToken = CAMPAIGN_TOKENS[swapData.chainId]?.[swapData.tokenOut.toLowerCase()];
  const nativeToken = "0x0000000000000000000000000000000000000000" as Address;
  const isCampaignRelevant = !!campaignToken && swapData.tokenIn === nativeToken;

  // Store swap record
  await db.swap.create({
    id: swapData.txHash,
    data: {
      txHash: swapData.txHash,
      chainId: swapData.chainId,
      blockNumber: swapData.blockNumber,
      blockTimestamp: swapData.blockTimestamp,
      from: swapData.from,
      to: swapData.to,
      tokenIn: swapData.tokenIn,
      tokenOut: swapData.tokenOut,
      amountIn: swapData.amountIn,
      amountOut: swapData.amountOut,
      router: swapData.router,
      methodSignature: swapData.methodSignature,
      isCampaignRelevant,
      campaignTaskId: campaignToken?.taskId,
    },
  });

  // If campaign relevant, process task completion
  if (isCampaignRelevant && campaignToken) {
    await processTaskCompletion(swapData, campaignToken.taskId, context);
  }

  // Update campaign stats
  await updateCampaignStats(swapData.chainId, context);
}

async function processTaskCompletion(
  swapData: SwapAnalysisResult,
  taskId: number,
  context: PonderContext
): Promise<void> {
  const { db } = context;

  const progressId = `${swapData.chainId}:${swapData.from.toLowerCase()}`;
  const completionId = `${swapData.chainId}:${swapData.from.toLowerCase()}:${taskId}`;

  // Ensure campaign progress exists
  await db.campaignProgress.upsert({
    id: progressId,
    create: {
      walletAddress: swapData.from,
      chainId: swapData.chainId,
      createdAt: swapData.blockTimestamp,
      updatedAt: swapData.blockTimestamp,
    },
    update: {
      updatedAt: swapData.blockTimestamp,
    },
  });

  // Record task completion (only if not already completed)
  await db.taskCompletion.upsert({
    id: completionId,
    create: {
      walletAddress: swapData.from,
      chainId: swapData.chainId,
      taskId,
      txHash: swapData.txHash,
      completedAt: swapData.blockTimestamp,
      swapAmount: swapData.amountOut,
      inputToken: swapData.tokenIn,
      outputToken: swapData.tokenOut,
      blockNumber: swapData.blockNumber,
    },
    update: {}, // Don't overwrite existing completions
  });
}

async function updateCampaignStats(chainId: number, context: PonderContext): Promise<void> {
  const { db } = context;

  // Get current stats counts
  const totalUsers = await db.campaignProgress.count({
    where: { chainId },
  });

  const totalSwaps = await db.swap.count({
    where: { chainId, isCampaignRelevant: true },
  });

  const task1Completions = await db.taskCompletion.count({
    where: { chainId, taskId: 1 },
  });

  const task2Completions = await db.taskCompletion.count({
    where: { chainId, taskId: 2 },
  });

  const task3Completions = await db.taskCompletion.count({
    where: { chainId, taskId: 3 },
  });

  // Calculate total volume
  const swaps = await db.swap.findMany({
    where: { chainId, isCampaignRelevant: true },
  });

  const totalVolume = swaps.reduce((sum, swap) => sum + swap.amountOut, 0n);

  await db.campaignStats.upsert({
    id: chainId.toString(),
    create: {
      chainId,
      totalUsers,
      totalSwaps,
      totalVolume,
      task1Completions,
      task2Completions,
      task3Completions,
      lastUpdated: BigInt(Date.now()),
    },
    update: {
      totalUsers,
      totalSwaps,
      totalVolume,
      task1Completions,
      task2Completions,
      task3Completions,
      lastUpdated: BigInt(Date.now()),
    },
  });
}

