// @ts-ignore
import { ponder } from "ponder:registry";
// @ts-ignore
import { nftClaim, nftClaimStats } from "ponder:schema";
import { getAddress } from "viem";
import { eq } from "ponder";

// Utility function with error handling
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

// NFT Claimed Event Handler
ponder.on("FirstSqueezerNFT:NFTClaimed", async ({ event, context }: { event: any; context: any }) => {
  try {
    // Extract event data safely
    const txHash = event?.transaction?.hash;
    const claimer = event?.args?.claimer;
    const tokenId = event?.args?.tokenId;
    const blockNumber = event?.block?.number;
    const blockTimestamp = event?.block?.timestamp;

    if (!txHash || !claimer) {
      console.warn("Missing required data for NFT claim - skipping");
      return;
    }

    const walletAddress = safeGetAddress(claimer);
    const chainId = 5115; // Citrea Testnet

    const claimId = `${chainId}:${walletAddress.toLowerCase()}`;

    console.log(`NFT Claimed: ${walletAddress} received token #${tokenId}`);

    // Store NFT claim record
    await context.db.insert(nftClaim).values({
      id: claimId,
      walletAddress: walletAddress,
      chainId: chainId,
      tokenId: String(tokenId || "0"),
      txHash: txHash,
      claimedAt: safeBigInt(blockTimestamp),
      blockNumber: safeBigInt(blockNumber),
    }).onConflictDoNothing();

    // Update aggregated statistics
    await updateNftClaimStats(context, chainId, blockTimestamp);

  } catch (error) {
    console.error("Error processing NFT claim:", error);
    // Continue execution - don't throw to prevent system crash
  }
});

// Helper function to update NFT claim statistics
async function updateNftClaimStats(context: any, chainId: number, timestamp: any) {
  try {
    // Get all NFT claims for this chain
    const allClaims = await context.db.select({
      walletAddress: nftClaim.walletAddress,
    }).from(nftClaim).where(eq(nftClaim.chainId, chainId));

    // Calculate stats
    const totalClaims = allClaims.length;
    const uniqueAddressesSet = new Set(
      allClaims.map((claim: any) => claim.walletAddress.toLowerCase())
    );
    const uniqueAddresses = uniqueAddressesSet.size;
    const claimingAddressesArray = Array.from(uniqueAddressesSet);

    const statsId = String(chainId);

    // Upsert stats
    await context.db.insert(nftClaimStats).values({
      id: statsId,
      chainId: chainId,
      totalClaims: totalClaims,
      uniqueAddresses: uniqueAddresses,
      claimingAddresses: JSON.stringify(claimingAddressesArray),
      lastUpdated: safeBigInt(timestamp),
    }).onConflictDoUpdate({
      totalClaims: totalClaims,
      uniqueAddresses: uniqueAddresses,
      claimingAddresses: JSON.stringify(claimingAddressesArray),
      lastUpdated: safeBigInt(timestamp),
    });

    console.log(`Updated NFT claim stats: ${totalClaims} total claims, ${uniqueAddresses} unique addresses`);
  } catch (error) {
    console.error("Error updating NFT claim stats:", error);
  }
}
