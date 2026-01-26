/**
 * Launchpad indexer - indexes TokenCreated, Buy, Sell, Graduated, ReadyForGraduation events
 */
import { launchpadToken, launchpadTrade, graduatedV2Pool } from "ponder.schema";
// @ts-ignore
import { ponder } from "ponder:registry";
import { safeGetAddress, safeBigInt } from "../utils/helpers";

const CITREA_TESTNET_CHAIN_ID = 5115;

// Bonding curve constants (from contract)
const INITIAL_VIRTUAL_TOKEN_RESERVES = 1073000000n * 10n**18n; // 1,073,000,000e18
const INITIAL_REAL_TOKEN_RESERVES = 793100000n * 10n**18n; // 793,100,000e18

/**
 * Calculate bonding curve progress in basis points (0-10000)
 * Progress = tokensSold / INITIAL_REAL * 10000
 * tokensSold = INITIAL_VIRTUAL - currentVirtualReserves
 */
function calculateProgress(virtualTokenReserves: bigint): number {
  const tokensSold = INITIAL_VIRTUAL_TOKEN_RESERVES - virtualTokenReserves;
  // Ensure we don't go negative or exceed bounds
  if (tokensSold <= 0n) return 0;
  const progressBps = (tokensSold * 10000n) / INITIAL_REAL_TOKEN_RESERVES;
  return Math.min(10000, Number(progressBps));
}

// Index new token creation from TokenFactory
ponder.on("TokenFactory:TokenCreated", async ({ event, context }: { event: any; context: any }) => {
  try {
    if (!event.transaction) {
      console.warn("[Launchpad] Missing transaction data for TokenCreated event, skipping");
      return;
    }

    const tokenAddress = safeGetAddress(event.args.token);
    const creatorAddress = safeGetAddress(event.args.creator);
    const baseAssetAddress = safeGetAddress(event.args.baseAsset);

    await context.db.insert(launchpadToken).values({
      id: tokenAddress,
      address: tokenAddress,
      chainId: CITREA_TESTNET_CHAIN_ID,
      name: event.args.name,
      symbol: event.args.symbol,
      creator: creatorAddress,
      baseAsset: baseAssetAddress,
      metadataURI: event.args.metadataURI ?? null, // New in v2.1.0 - nullable for backwards compatibility
      createdAt: safeBigInt(event.block.timestamp),
      createdAtBlock: safeBigInt(event.block.number),
      txHash: event.transaction.hash,
      graduated: false,
      canGraduate: false,
      totalBuys: 0,
      totalSells: 0,
      totalVolumeBase: 0n,
      progress: 0,
    }).onConflictDoNothing();

    console.log(`[Launchpad] Indexed new token: ${event.args.symbol} (${tokenAddress}) with metadata: ${event.args.metadataURI ?? 'none'}`);
  } catch (error) {
    console.error("[Launchpad] Error indexing TokenCreated:", error);
  }
});

// Index buy trades from BondingCurveToken
ponder.on("BondingCurveToken:Buy", async ({ event, context }: { event: any; context: any }) => {
  try {
    if (!event.transaction) {
      console.warn("[Launchpad] Missing transaction data for Buy event, skipping");
      return;
    }

    const tokenAddress = safeGetAddress(event.log.address);
    const traderAddress = safeGetAddress(event.args.buyer);
    const tradeId = `${event.transaction.hash}-${event.log.logIndex}`;

    // Insert trade record
    await context.db.insert(launchpadTrade).values({
      id: tradeId,
      tokenAddress,
      chainId: CITREA_TESTNET_CHAIN_ID,
      trader: traderAddress,
      isBuy: true,
      baseAmount: event.args.baseIn,
      tokenAmount: event.args.tokensOut,
      timestamp: safeBigInt(event.block.timestamp),
      blockNumber: safeBigInt(event.block.number),
      txHash: event.transaction.hash,
    }).onConflictDoNothing();

    // Calculate progress from virtual token reserves emitted in event
    const progress = calculateProgress(event.args.virtualTokenReserves);

    // Update token stats
    await context.db
      .update(launchpadToken, { id: tokenAddress })
      .set((row: any) => ({
        totalBuys: row.totalBuys + 1,
        totalVolumeBase: row.totalVolumeBase + event.args.baseIn,
        lastTradeAt: safeBigInt(event.block.timestamp),
        progress,
      }));
  } catch (error) {
    console.error("[Launchpad] Error indexing Buy:", error);
  }
});

// Index sell trades from BondingCurveToken
ponder.on("BondingCurveToken:Sell", async ({ event, context }: { event: any; context: any }) => {
  try {
    if (!event.transaction) {
      console.warn("[Launchpad] Missing transaction data for Sell event, skipping");
      return;
    }

    const tokenAddress = safeGetAddress(event.log.address);
    const traderAddress = safeGetAddress(event.args.seller);
    const tradeId = `${event.transaction.hash}-${event.log.logIndex}`;

    // Insert trade record
    await context.db.insert(launchpadTrade).values({
      id: tradeId,
      tokenAddress,
      chainId: CITREA_TESTNET_CHAIN_ID,
      trader: traderAddress,
      isBuy: false,
      baseAmount: event.args.baseOut,
      tokenAmount: event.args.tokensIn,
      timestamp: safeBigInt(event.block.timestamp),
      blockNumber: safeBigInt(event.block.number),
      txHash: event.transaction.hash,
    }).onConflictDoNothing();

    // Calculate progress from virtual token reserves emitted in event
    const progress = calculateProgress(event.args.virtualTokenReserves);

    // Update token stats
    await context.db
      .update(launchpadToken, { id: tokenAddress })
      .set((row: any) => ({
        totalSells: row.totalSells + 1,
        totalVolumeBase: row.totalVolumeBase + event.args.baseOut,
        lastTradeAt: safeBigInt(event.block.timestamp),
        progress,
      }));
  } catch (error) {
    console.error("[Launchpad] Error indexing Sell:", error);
  }
});

// Index graduation event
ponder.on("BondingCurveToken:Graduated", async ({ event, context }: { event: any; context: any }) => {
  try {
    if (!event.transaction) {
      console.warn("[Launchpad] Missing transaction data for Graduated event, skipping");
      return;
    }

    const tokenAddress = safeGetAddress(event.log.address);
    const pairAddress = safeGetAddress(event.args.pair);

    // Update launchpad token record
    await context.db
      .update(launchpadToken, { id: tokenAddress })
      .set({
        graduated: true,
        canGraduate: false,
        v2Pair: pairAddress,
        graduatedAt: safeBigInt(event.block.timestamp),
      });

    // Fetch the token to get its baseAsset
    const tokenRecord = await context.db.find(launchpadToken, { id: tokenAddress });

    if (tokenRecord) {
      // Determine token0/token1 (V2 pairs sort by address - lower is token0)
      const tokenAddrLower = tokenAddress.toLowerCase();
      const baseAssetLower = tokenRecord.baseAsset.toLowerCase();
      const isTokenToken0 = tokenAddrLower < baseAssetLower;

      const token0 = isTokenToken0 ? tokenAddress : tokenRecord.baseAsset;
      const token1 = isTokenToken0 ? tokenRecord.baseAsset : tokenAddress;

      // Create graduated V2 pool record
      await context.db.insert(graduatedV2Pool).values({
        id: pairAddress,
        pairAddress,
        chainId: CITREA_TESTNET_CHAIN_ID,
        token0,
        token1,
        launchpadTokenAddress: tokenAddress,
        createdAt: safeBigInt(event.block.timestamp),
        createdAtBlock: safeBigInt(event.block.number),
        txHash: event.transaction.hash,
        totalSwaps: 0,
      }).onConflictDoNothing();

      console.log(`[Launchpad] Token graduated: ${tokenAddress} -> V2 pair ${pairAddress} (token0: ${token0}, token1: ${token1})`);
    } else {
      console.warn(`[Launchpad] Could not find token record for graduated token: ${tokenAddress}`);
    }
  } catch (error) {
    console.error("[Launchpad] Error indexing Graduated:", error);
  }
});

// Index ready for graduation event
ponder.on("BondingCurveToken:ReadyForGraduation", async ({ event, context }: { event: any; context: any }) => {
  try {
    const tokenAddress = safeGetAddress(event.log.address);

    await context.db
      .update(launchpadToken, { id: tokenAddress })
      .set({ canGraduate: true });

    console.log(`[Launchpad] Token ready for graduation: ${tokenAddress}`);
  } catch (error) {
    console.error("[Launchpad] Error indexing ReadyForGraduation:", error);
  }
});
