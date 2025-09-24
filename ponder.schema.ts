import { onchainTable } from "ponder";

export const taskCompletion = onchainTable("task_completion", (t) => ({
  id: t.text().primaryKey(), // Format: {chainId}:{walletAddress}:{taskId}
  walletAddress: t.hex().notNull(),
  chainId: t.integer().notNull(),
  taskId: t.integer().notNull(),
  txHash: t.hex().notNull(),
  completedAt: t.bigint().notNull(),
  swapAmount: t.bigint(),
  inputToken: t.hex(),
  outputToken: t.hex().notNull(),
  blockNumber: t.bigint().notNull(),
}));

export const swap = onchainTable("swap", (t) => ({
  id: t.text().primaryKey(), // txHash
  txHash: t.hex().notNull(),
  chainId: t.integer().notNull(),
  blockNumber: t.bigint().notNull(),
  blockTimestamp: t.bigint().notNull(),
  from: t.hex().notNull(),
  to: t.hex().notNull(),
  tokenIn: t.hex().notNull(),
  tokenOut: t.hex().notNull(),
  amountIn: t.bigint().notNull(),
  amountOut: t.bigint().notNull(),
  router: t.hex().notNull(),
  methodSignature: t.text().notNull(),
  isCampaignRelevant: t.boolean().notNull(),
  campaignTaskId: t.integer(),
}));