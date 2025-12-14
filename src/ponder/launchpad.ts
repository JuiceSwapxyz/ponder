/**
 * Launchpad indexer - indexes TokenCreated, Buy, Sell, Graduated, ReadyForGraduation events
 */
import { launchpadToken, launchpadTrade } from "ponder.schema";
// @ts-ignore
import { ponder } from "ponder:registry";
import { getAddress } from "viem";

const CITREA_TESTNET_CHAIN_ID = 5115;

// Index new token creation from TokenFactory
ponder.on("TokenFactory:TokenCreated", async ({ event, context }: { event: any; context: any }) => {
  try {
    const tokenAddress = getAddress(event.args.token);

    await context.db.insert(launchpadToken).values({
      id: tokenAddress,
      address: tokenAddress,
      chainId: CITREA_TESTNET_CHAIN_ID,
      name: event.args.name,
      symbol: event.args.symbol,
      creator: getAddress(event.args.creator),
      baseAsset: getAddress(event.args.baseAsset),
      createdAt: event.block.timestamp,
      createdAtBlock: event.block.number,
      txHash: event.transaction.hash,
      graduated: false,
      canGraduate: false,
      totalBuys: 0,
      totalSells: 0,
      totalVolumeBase: 0n,
    }).onConflictDoNothing();

    console.log(`[Launchpad] Indexed new token: ${event.args.symbol} (${tokenAddress})`);
  } catch (error) {
    console.error("[Launchpad] Error indexing TokenCreated:", error);
  }
});

// Index buy trades from BondingCurveToken
ponder.on("BondingCurveToken:Buy", async ({ event, context }: { event: any; context: any }) => {
  try {
    const tokenAddress = getAddress(event.log.address);
    const tradeId = `${event.transaction.hash}-${event.log.logIndex}`;

    // Insert trade record
    await context.db.insert(launchpadTrade).values({
      id: tradeId,
      tokenAddress,
      chainId: CITREA_TESTNET_CHAIN_ID,
      trader: getAddress(event.args.buyer),
      isBuy: true,
      baseAmount: event.args.baseIn,
      tokenAmount: event.args.tokensOut,
      timestamp: event.block.timestamp,
      blockNumber: event.block.number,
      txHash: event.transaction.hash,
    }).onConflictDoNothing();

    // Update token stats
    await context.db
      .update(launchpadToken, { id: tokenAddress })
      .set((row: any) => ({
        totalBuys: row.totalBuys + 1,
        totalVolumeBase: row.totalVolumeBase + event.args.baseIn,
        lastTradeAt: event.block.timestamp,
      }));
  } catch (error) {
    console.error("[Launchpad] Error indexing Buy:", error);
  }
});

// Index sell trades from BondingCurveToken
ponder.on("BondingCurveToken:Sell", async ({ event, context }: { event: any; context: any }) => {
  try {
    const tokenAddress = getAddress(event.log.address);
    const tradeId = `${event.transaction.hash}-${event.log.logIndex}`;

    // Insert trade record
    await context.db.insert(launchpadTrade).values({
      id: tradeId,
      tokenAddress,
      chainId: CITREA_TESTNET_CHAIN_ID,
      trader: getAddress(event.args.seller),
      isBuy: false,
      baseAmount: event.args.baseOut,
      tokenAmount: event.args.tokensIn,
      timestamp: event.block.timestamp,
      blockNumber: event.block.number,
      txHash: event.transaction.hash,
    }).onConflictDoNothing();

    // Update token stats
    await context.db
      .update(launchpadToken, { id: tokenAddress })
      .set((row: any) => ({
        totalSells: row.totalSells + 1,
        totalVolumeBase: row.totalVolumeBase + event.args.baseOut,
        lastTradeAt: event.block.timestamp,
      }));
  } catch (error) {
    console.error("[Launchpad] Error indexing Sell:", error);
  }
});

// Index graduation event
ponder.on("BondingCurveToken:Graduated", async ({ event, context }: { event: any; context: any }) => {
  try {
    const tokenAddress = getAddress(event.log.address);

    await context.db
      .update(launchpadToken, { id: tokenAddress })
      .set({
        graduated: true,
        canGraduate: false,
        v2Pair: getAddress(event.args.pair),
        graduatedAt: event.block.timestamp,
      });

    console.log(`[Launchpad] Token graduated: ${tokenAddress} -> pair ${event.args.pair}`);
  } catch (error) {
    console.error("[Launchpad] Error indexing Graduated:", error);
  }
});

// Index ready for graduation event
ponder.on("BondingCurveToken:ReadyForGraduation", async ({ event, context }: { event: any; context: any }) => {
  try {
    const tokenAddress = getAddress(event.log.address);

    await context.db
      .update(launchpadToken, { id: tokenAddress })
      .set({ canGraduate: true });

    console.log(`[Launchpad] Token ready for graduation: ${tokenAddress}`);
  } catch (error) {
    console.error("[Launchpad] Error indexing ReadyForGraduation:", error);
  }
});
