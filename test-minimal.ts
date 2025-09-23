import { ponder } from "ponder:registry";

// Minimal test handler - just log the event structure
ponder.on("CBTCNUSDPool_CitreaTestnet:Swap", async ({ event, context }) => {
  console.log("=== CITREA TRANSPORT TEST ===");
  console.log("Event received:", {
    blockNumber: event.block.number,
    txHash: event.transaction.hash,
    logIndex: event.log.logIndex,
    transactionIndex: event.log.transactionIndex,
    eventArgs: event.args
  });

  // Test if transaction indices are corrected
  console.log("Transaction index check:", {
    originalIndex: event.log.transactionIndex,
    isValidIndex: typeof event.log.transactionIndex === 'string' && event.log.transactionIndex.startsWith('0x')
  });
});