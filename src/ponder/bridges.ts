// @ts-ignore
import { ponder } from "ponder:registry";
import { oftBridgeEvent } from "ponder.schema";
import { safeGetAddress } from "@/utils/helpers";
import { getAddress } from "viem";

ponder.on(
  "LayerZeroOFT:OFTSent",
  async ({ event, context }: { event: any; context: any }) => {
    try {
      const chainId = context.chain.id;

      await context.db.insert(oftBridgeEvent).values({
        id: `${chainId}:${event.transaction.hash}:${event.log.logIndex}`,
        chainId,
        direction: "sent",
        guid: event.args.guid,
        remoteEid: event.args.dstEid,
        userAddress: safeGetAddress(event.args.fromAddress),
        amountSentLD: event.args.amountSentLD,
        amountReceivedLD: event.args.amountReceivedLD,
        tokenAddress: getAddress(event.log.address),
        blockNumber: event.block.number,
        blockTimestamp: event.block.timestamp,
        txHash: event.transaction.hash,
      }).onConflictDoNothing();
    } catch (error) {
      console.error("[Bridges] Error processing OFTSent:", error);
    }
  }
);

ponder.on(
  "LayerZeroOFT:OFTReceived",
  async ({ event, context }: { event: any; context: any }) => {
    try {
      const chainId = context.chain.id;

      await context.db.insert(oftBridgeEvent).values({
        id: `${chainId}:${event.transaction.hash}:${event.log.logIndex}`,
        chainId,
        direction: "received",
        guid: event.args.guid,
        remoteEid: event.args.srcEid,
        userAddress: safeGetAddress(event.args.toAddress),
        amountSentLD: null,
        amountReceivedLD: event.args.amountReceivedLD,
        tokenAddress: getAddress(event.log.address),
        blockNumber: event.block.number,
        blockTimestamp: event.block.timestamp,
        txHash: event.transaction.hash,
      }).onConflictDoNothing();
    } catch (error) {
      console.error("[Bridges] Error processing OFTReceived:", error);
    }
  }
);
