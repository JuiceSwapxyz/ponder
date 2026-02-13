// @ts-ignore
import { ponder } from "ponder:registry";
import {
  feeCollectorOwnerUpdate,
  feeCollectorRouterUpdate,
  feeCollectorCollectorUpdate,
  feeCollectorProtectionUpdate,
} from "ponder.schema";
import { safeGetAddress } from "@/utils/helpers";

ponder.on(
  "JuiceSwapFeeCollector:FactoryOwnerUpdated",
  async ({ event, context }: { event: any; context: any }) => {
    try {
      const chainId = context.chain.id;

      await context.db.insert(feeCollectorOwnerUpdate).values({
        id: `${chainId}:${event.transaction.hash}:${event.log.logIndex}`,
        chainId,
        newOwner: safeGetAddress(event.args.newOwner),
        blockNumber: event.block.number,
        blockTimestamp: event.block.timestamp,
        txHash: event.transaction.hash,
      }).onConflictDoNothing();
    } catch (error) {
      console.error("[FeeCollector] Error processing FactoryOwnerUpdated:", error);
    }
  }
);

ponder.on(
  "JuiceSwapFeeCollector:SwapRouterUpdated",
  async ({ event, context }: { event: any; context: any }) => {
    try {
      const chainId = context.chain.id;

      await context.db.insert(feeCollectorRouterUpdate).values({
        id: `${chainId}:${event.transaction.hash}:${event.log.logIndex}`,
        chainId,
        oldRouter: safeGetAddress(event.args.oldRouter),
        newRouter: safeGetAddress(event.args.newRouter),
        blockNumber: event.block.number,
        blockTimestamp: event.block.timestamp,
        txHash: event.transaction.hash,
      }).onConflictDoNothing();
    } catch (error) {
      console.error("[FeeCollector] Error processing SwapRouterUpdated:", error);
    }
  }
);

ponder.on(
  "JuiceSwapFeeCollector:CollectorUpdated",
  async ({ event, context }: { event: any; context: any }) => {
    try {
      const chainId = context.chain.id;

      await context.db.insert(feeCollectorCollectorUpdate).values({
        id: `${chainId}:${event.transaction.hash}:${event.log.logIndex}`,
        chainId,
        oldCollector: safeGetAddress(event.args.oldCollector),
        newCollector: safeGetAddress(event.args.newCollector),
        blockNumber: event.block.number,
        blockTimestamp: event.block.timestamp,
        txHash: event.transaction.hash,
      }).onConflictDoNothing();
    } catch (error) {
      console.error("[FeeCollector] Error processing CollectorUpdated:", error);
    }
  }
);

ponder.on(
  "JuiceSwapFeeCollector:ProtectionParamsUpdated",
  async ({ event, context }: { event: any; context: any }) => {
    try {
      const chainId = context.chain.id;

      await context.db.insert(feeCollectorProtectionUpdate).values({
        id: `${chainId}:${event.transaction.hash}:${event.log.logIndex}`,
        chainId,
        twapPeriod: event.args.twapPeriod,
        maxSlippageBps: event.args.maxSlippageBps,
        blockNumber: event.block.number,
        blockTimestamp: event.block.timestamp,
        txHash: event.transaction.hash,
      }).onConflictDoNothing();
    } catch (error) {
      console.error("[FeeCollector] Error processing ProtectionParamsUpdated:", error);
    }
  }
);
