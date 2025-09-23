import { onchainTable, index } from "ponder";

export const campaignProgress = onchainTable("campaign_progress", (t) => ({
  id: t.text().primaryKey(), // Format: {chainId}:{walletAddress}
  walletAddress: t.hex().notNull(),
  chainId: t.integer().notNull(),
  createdAt: t.bigint().notNull(),
  updatedAt: t.bigint().notNull(),
}));

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

export const token = onchainTable("token", (t) => ({
  id: t.text().primaryKey(), // Format: {chainId}:{address}
  address: t.hex().notNull(),
  chainId: t.integer().notNull(),
  symbol: t.text(),
  name: t.text(),
  decimals: t.integer(),
  isCampaignToken: t.boolean().notNull(),
  campaignTaskId: t.integer(),
}));

export const campaignStats = onchainTable("campaign_stats", (t) => ({
  id: t.text().primaryKey(), // Format: {chainId}
  chainId: t.integer().notNull(),
  totalUsers: t.integer().notNull(),
  totalSwaps: t.integer().notNull(),
  totalVolume: t.bigint().notNull(),
  task1Completions: t.integer().notNull(),
  task2Completions: t.integer().notNull(),
  task3Completions: t.integer().notNull(),
  lastUpdated: t.bigint().notNull(),
}));