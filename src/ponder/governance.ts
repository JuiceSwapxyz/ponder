// @ts-ignore
import { ponder } from "ponder:registry";
import {
  governorProposal,
  factoryOwnerChange,
  gatewayBridgedTokenRegistration,
} from "ponder.schema";
import { safeGetAddress } from "@/utils/helpers";

// ============ JuiceSwapGovernor ============

ponder.on(
  "JuiceSwapGovernor:ProposalCreated",
  async ({ event, context }: { event: any; context: any }) => {
    try {
      const chainId = context.chain.id;

      await context.db.insert(governorProposal).values({
        id: `${chainId}:${event.args.proposalId}`,
        chainId,
        proposalId: event.args.proposalId,
        proposer: safeGetAddress(event.args.proposer),
        target: safeGetAddress(event.args.target),
        calldata: event.args.data,
        executeAfter: event.args.executeAfter,
        description: event.args.description,
        status: "active",
        executedBy: null,
        vetoedBy: null,
        createdAtBlock: event.block.number,
        createdAt: event.block.timestamp,
        txHash: event.transaction.hash,
        resolvedAt: null,
        resolvedTxHash: null,
      }).onConflictDoNothing();
    } catch (error) {
      console.error("[Governance] Error processing ProposalCreated:", error);
    }
  }
);

ponder.on(
  "JuiceSwapGovernor:ProposalExecuted",
  async ({ event, context }: { event: any; context: any }) => {
    try {
      const chainId = context.chain.id;
      const id = `${chainId}:${event.args.proposalId}`;

      await context.db
        .update(governorProposal, { id })
        .set({
          status: "executed",
          executedBy: safeGetAddress(event.args.executor),
          resolvedAt: event.block.timestamp,
          resolvedTxHash: event.transaction.hash,
        });
    } catch (error) {
      console.error("[Governance] Error processing ProposalExecuted:", error);
    }
  }
);

ponder.on(
  "JuiceSwapGovernor:ProposalVetoed",
  async ({ event, context }: { event: any; context: any }) => {
    try {
      const chainId = context.chain.id;
      const id = `${chainId}:${event.args.proposalId}`;

      await context.db
        .update(governorProposal, { id })
        .set({
          status: "vetoed",
          vetoedBy: safeGetAddress(event.args.vetoer),
          resolvedAt: event.block.timestamp,
          resolvedTxHash: event.transaction.hash,
        });
    } catch (error) {
      console.error("[Governance] Error processing ProposalVetoed:", error);
    }
  }
);

// ============ UniswapV3Factory OwnerChanged ============

ponder.on(
  "UniswapV3Factory:OwnerChanged",
  async ({ event, context }: { event: any; context: any }) => {
    try {
      const chainId = context.chain.id;

      await context.db.insert(factoryOwnerChange).values({
        id: `${chainId}:${event.transaction.hash}:${event.log.logIndex}`,
        chainId,
        oldOwner: safeGetAddress(event.args.oldOwner),
        newOwner: safeGetAddress(event.args.newOwner),
        blockNumber: event.block.number,
        blockTimestamp: event.block.timestamp,
        txHash: event.transaction.hash,
      }).onConflictDoNothing();
    } catch (error) {
      console.error("[Governance] Error processing OwnerChanged:", error);
    }
  }
);

// ============ JuiceSwapGateway BridgedTokenRegistered ============

ponder.on(
  "JuiceSwapGateway:BridgedTokenRegistered",
  async ({ event, context }: { event: any; context: any }) => {
    try {
      const chainId = context.chain.id;

      await context.db.insert(gatewayBridgedTokenRegistration).values({
        id: `${chainId}:${event.transaction.hash}:${event.log.logIndex}`,
        chainId,
        token: safeGetAddress(event.args.token),
        bridge: safeGetAddress(event.args.bridge),
        registeredBy: safeGetAddress(event.args.registeredBy),
        decimals: event.args.decimals,
        blockNumber: event.block.number,
        blockTimestamp: event.block.timestamp,
        txHash: event.transaction.hash,
      }).onConflictDoNothing();
    } catch (error) {
      console.error("[Governance] Error processing BridgedTokenRegistered:", error);
    }
  }
);
