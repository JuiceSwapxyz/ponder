// @ts-ignore
import { ponder } from "ponder:registry";
// @ts-ignore
import { syncProgress } from "ponder:schema";

const CHAIN_ID = 5115; // Citrea Testnet
const CHAIN_NAME = "citreaTestnet";
const UPDATE_INTERVAL = 10; // Update every 10 blocks

// Track sync progress using block intervals
// This updates every N blocks to track the latest indexed block
ponder.on("UniswapV3Factory:block", async ({ event, context }) => {
  try {
    const blockNumber = BigInt(event.block.number);
    const blockTimestamp = BigInt(event.block.timestamp);

    // Only update every N blocks to reduce database writes
    if (Number(blockNumber) % UPDATE_INTERVAL !== 0) {
      return;
    }

    // Update or insert the sync progress for this chain
    await context.db
      .insert(syncProgress)
      .values({
        id: CHAIN_NAME,
        chainId: CHAIN_ID,
        latestBlock: blockNumber,
        lastUpdated: blockTimestamp,
      })
      .onConflictDoUpdate({
        latestBlock: blockNumber,
        lastUpdated: blockTimestamp,
      });

  } catch (error) {
    console.error("Error updating sync progress:", error);
    // Continue execution - don't throw to prevent system crash
  }
});
