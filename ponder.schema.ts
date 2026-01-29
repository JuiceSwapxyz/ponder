import { onchainTable } from "ponder";

// TypeScript types for JSON structures
export interface Token {
  chainId: number;
  address: string;
  symbol: string;
  decimals: number;
  name: string;
}

export interface V3Position {
  tokenId: string;
  tickLower: string;
  tickUpper: string;
  liquidity: string;
  token0: Token;
  token1: Token;
  feeTier: string;
  currentTick: string;
  currentPrice: string;
  tickSpacing: string;
  token0UncollectedFees: string;
  token1UncollectedFees: string;
  amount0: string;
  amount1: string;
  poolId: string;
  totalLiquidityUsd: string;
  currentLiquidity: string;
}

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

export const nftClaim = onchainTable("nft_claim", (t) => ({
  id: t.text().primaryKey(), // Format: {chainId}:{walletAddress}
  walletAddress: t.hex().notNull(),
  chainId: t.integer().notNull(),
  tokenId: t.text().notNull(),
  txHash: t.hex().notNull(),
  claimedAt: t.bigint().notNull(),
  blockNumber: t.bigint().notNull(),
}));

export const nftOwner = onchainTable("nft_owner", (t) => ({
  id: t.text().primaryKey(),
  owner: t.hex().notNull(),
  chainId: t.integer().notNull(),
  tokenId: t.text().notNull(),
  contractAddress: t.hex().notNull(),
  timestamp: t.bigint().notNull(),
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

export const pool = onchainTable("pool", (t) => ({
  id: t.text().primaryKey(),
  chainId: t.integer().notNull(),
  address: t.text().notNull(),
  token0: t.text().notNull(),
  token1: t.text().notNull(),
  fee: t.integer().notNull(),
  tickSpacing: t.integer().notNull(),
  createdAt: t.bigint().notNull(),
}));

export const position = onchainTable("position", (t) => ({
  id: t.text().primaryKey(),
  chainId: t.integer().notNull(),
  tokenId: t.text(),
  owner: t.text(),
  poolAddress: t.text(),
  tickLower: t.integer(),
  tickUpper: t.integer(),
  amount0: t.bigint(),
  amount1: t.bigint(),
}));

export const token = onchainTable("token", (t) => ({
  id: t.text().primaryKey(),
  chainId: t.integer().notNull(),
  address: t.text().notNull(),
  symbol: t.text().notNull(),
  decimals: t.integer().notNull(),
  name: t.text().notNull(),
}));

export const transactionSwap = onchainTable("transactionSwap", (t) => ({
  id: t.text().primaryKey(),
  swapperAddress: t.text().notNull(),
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
}));

export const poolActivity = onchainTable("poolActivity", (t) => ({
  id: t.text().primaryKey(),
  chainId: t.integer().notNull(),
  poolAddress: t.hex().notNull(),
  blockNumber: t.bigint().notNull(),
  blockTimestamp: t.bigint().notNull(),
  txHash: t.hex().notNull(),
  sender: t.text().notNull(),
  recipient: t.text().notNull(),
  amount0: t.bigint().notNull(),
  amount1: t.bigint().notNull(),
  sqrtPriceX96: t.bigint().notNull(),
  liquidity: t.bigint().notNull(),
  tick: t.integer().notNull(),
}));

export const tokenStat = onchainTable("tokenStat", (t) => ({
  id: t.text().primaryKey(), // Token address + timestamp 1h or 24h rounded down
  chainId: t.integer().notNull(),
  address: t.text().notNull(),
  timestamp: t.bigint().notNull(),
  txCount: t.integer().notNull(),
  volume: t.bigint().notNull(),
  type: t.text().notNull(), // "1h", "24h", "all-time"
}));

export const poolStat = onchainTable("poolStat", (t) => ({
  id: t.text().primaryKey(), // Pool address + timestamp 1h or 24h rounded down
  chainId: t.integer().notNull(),
  poolAddress: t.text().notNull(),
  timestamp: t.bigint().notNull(),
  txCount: t.integer().notNull(),
  volume0: t.bigint().notNull(),
  volume1: t.bigint().notNull(),
  type: t.text().notNull(), // "1h", "24h", "all-time"
}));

export const blockProgress = onchainTable("blockProgress", (t) => ({
  id: t.text().primaryKey(),
  chainId: t.integer().notNull(),
  blockNumber: t.bigint().notNull(),
  blockTimestamp: t.bigint().notNull(),
  lastUpdatedAt: t.bigint().notNull(),
}));

// ============ LAUNCHPAD SCHEMA ============

export const launchpadToken = onchainTable("launchpadToken", (t) => ({
  id: t.text().primaryKey(), // token address
  address: t.hex().notNull(),
  chainId: t.integer().notNull(),
  name: t.text().notNull(),
  symbol: t.text().notNull(),
  creator: t.hex().notNull(),
  baseAsset: t.hex().notNull(),
  metadataURI: t.text(), // URI pointing to token metadata JSON (IPFS/Arweave/HTTPS) - nullable for pre-v2.1.0 tokens
  createdAt: t.bigint().notNull(),
  createdAtBlock: t.bigint().notNull(),
  txHash: t.hex().notNull(),

  // State (updated on each trade/graduation)
  graduated: t.boolean().notNull().default(false),
  canGraduate: t.boolean().notNull().default(false),
  v2Pair: t.hex(),
  graduatedAt: t.bigint(),

  // Stats (updated on trades)
  totalBuys: t.integer().notNull().default(0),
  totalSells: t.integer().notNull().default(0),
  totalVolumeBase: t.bigint().notNull().default(0n),
  lastTradeAt: t.bigint(),
  // Progress in basis points (0-10000) for bonding curve completion
  progress: t.integer().notNull().default(0),
}));

export const launchpadTrade = onchainTable("launchpadTrade", (t) => ({
  id: t.text().primaryKey(), // txHash-logIndex
  tokenAddress: t.hex().notNull(),
  chainId: t.integer().notNull(),
  trader: t.hex().notNull(),
  isBuy: t.boolean().notNull(),
  baseAmount: t.bigint().notNull(),
  tokenAmount: t.bigint().notNull(),
  timestamp: t.bigint().notNull(),
  blockNumber: t.bigint().notNull(),
  txHash: t.hex().notNull(),
}));

// V2 pools created when launchpad tokens graduate
export const graduatedV2Pool = onchainTable("graduatedV2Pool", (t) => ({
  id: t.text().primaryKey(), // pair address
  pairAddress: t.hex().notNull(),
  chainId: t.integer().notNull(),
  token0: t.hex().notNull(),
  token1: t.hex().notNull(),
  launchpadTokenAddress: t.hex().notNull(), // link back to launchpad token
  createdAt: t.bigint().notNull(),
  createdAtBlock: t.bigint().notNull(),
  txHash: t.hex().notNull(),
  totalSwaps: t.integer().notNull().default(0),
}));
