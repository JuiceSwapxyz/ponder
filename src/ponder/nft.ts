// @ts-ignore
import { ponder } from "ponder:registry";
// @ts-ignore
import { nftClaim, nftOwner } from "ponder:schema";
import { getAddress } from "viem";
import { safeGetAddress, safeBigInt } from "../utils/helpers";

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

    } catch (error) {
      console.error("Error processing NFT claim:", error);
    }
  }
);

ponder.on("FirstSqueezerNFT:Transfer", async ({ event, context }: { event: any; context: any }) => {
  try {
    const chainId = 5115;
    const tokenId = event?.args?.tokenId;
    const contractAddress = safeGetAddress(event?.log?.address);
    
    await context.db.insert(nftOwner).values({
      id: `${chainId}-${tokenId}-${contractAddress}`,
      owner: getAddress(event?.args?.to),
      chainId: chainId,
      tokenId: String(tokenId || "0"),
      contractAddress,
      timestamp: safeBigInt(event?.block?.timestamp),
    }).onConflictDoUpdate({
      owner: getAddress(event?.args?.to),
      timestamp: safeBigInt(event?.block?.timestamp),
    })
  } catch (error) {
    console.error("Error processing NFT transfer:", error);
  }
})
