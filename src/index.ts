import { ponder } from "ponder:registry";
import { swap } from "ponder:schema";

// Step 1: Add minimal DB operation with unique ID
ponder.on("CBTCNUSDPool_CitreaTestnet:Swap", async ({ event, context }) => {
  console.log(`🔵 NUSD Event: ${event.transaction.hash}`);

  const uniqueId = `${event.transaction.hash}-${event.log.logIndex}`;
  await context.db.insert(swap).values({
    id: uniqueId,
    txHash: event.transaction.hash,
    chainId: 5115,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    from: "0x0000000000000000000000000000000000000000",
    to: "0x0000000000000000000000000000000000000000",
    tokenIn: "0x0000000000000000000000000000000000000000",
    tokenOut: "0x0000000000000000000000000000000000000000",
    amountIn: BigInt(0),
    amountOut: BigInt(0),
    router: "0x0000000000000000000000000000000000000000",
    methodSignature: "0x",
    isCampaignRelevant: false,
    campaignTaskId: null,
  });
});

ponder.on("CBTCcUSDPool_CitreaTestnet:Swap", async ({ event, context }) => {
  console.log(`🟡 cUSD Event: ${event.transaction.hash}`);

  const uniqueId = `${event.transaction.hash}-${event.log.logIndex}`;
  await context.db.insert(swap).values({
    id: uniqueId,
    txHash: event.transaction.hash,
    chainId: 5115,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    from: "0x0000000000000000000000000000000000000000",
    to: "0x0000000000000000000000000000000000000000",
    tokenIn: "0x0000000000000000000000000000000000000000",
    tokenOut: "0x0000000000000000000000000000000000000000",
    amountIn: BigInt(0),
    amountOut: BigInt(0),
    router: "0x0000000000000000000000000000000000000000",
    methodSignature: "0x",
    isCampaignRelevant: false,
    campaignTaskId: null,
  });
});

ponder.on("CBTCUSDCPool_CitreaTestnet:Swap", async ({ event, context }) => {
  console.log(`🟢 USDC Event: ${event.transaction.hash}`);

  const uniqueId = `${event.transaction.hash}-${event.log.logIndex}`;
  await context.db.insert(swap).values({
    id: uniqueId,
    txHash: event.transaction.hash,
    chainId: 5115,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    from: "0x0000000000000000000000000000000000000000",
    to: "0x0000000000000000000000000000000000000000",
    tokenIn: "0x0000000000000000000000000000000000000000",
    tokenOut: "0x0000000000000000000000000000000000000000",
    amountIn: BigInt(0),
    amountOut: BigInt(0),
    router: "0x0000000000000000000000000000000000000000",
    methodSignature: "0x",
    isCampaignRelevant: false,
    campaignTaskId: null,
  });
});