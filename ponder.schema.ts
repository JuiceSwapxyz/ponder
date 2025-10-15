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
/*
Example "Position", we will use it to build a new schema for positions
{
  "chainId": 11155111,
  "protocolVersion": "PROTOCOL_VERSION_V3",
  "v3Position": {
      "tokenId": "210447",
      "liquidity": "37945455597966861",
      "feeTier": "3000",
      "currentTick": "-115136",
      "currentPrice": "250529060232794967902094762",
      "tickSpacing": "60",
      "token0UncollectedFees": "0",
      "token1UncollectedFees": "0",
      "amount0": "11999999999999921393",
      "amount1": "119988133378106",
      "totalLiquidityUsd": "5.265636176503667857671428106519472",
      "currentLiquidity": "104350002894409105"
  },
  "status": "POSITION_STATUS_IN_RANGE",
  "timestamp": 1758667656
}
*/

export const pool = onchainTable("pool", (t) => ({
  id: t.text().primaryKey(),
  chainId: t.numeric().notNull(),
  address: t.text().notNull(),
  token0: t.text().notNull(),
  token1: t.text().notNull(),
  fee: t.integer().notNull(),
  tickSpacing: t.integer().notNull(),
  createdAt: t.bigint().notNull(),
}));

export const position = onchainTable("position", (t) => ({
  id: t.text().primaryKey(),
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
  address: t.text().notNull(),
  timestamp: t.bigint().notNull(),
  txCount: t.integer().notNull(),
  volume: t.bigint().notNull(),
  type: t.text().notNull(), // "1h", "24h", "all-time"
}));

export const poolStat = onchainTable("poolStat", (t) => ({
  id: t.text().primaryKey(), // Pool address + timestamp 1h or 24h rounded down
  poolAddress: t.text().notNull(),
  timestamp: t.bigint().notNull(),
  txCount: t.integer().notNull(),
  volume0: t.bigint().notNull(),
  volume1: t.bigint().notNull(),
  type: t.text().notNull(), // "1h", "24h", "all-time"
}));

export const syncProgress = onchainTable("syncProgress", (t) => ({
  id: t.text().primaryKey(), // Chain identifier (e.g., "citreaTestnet")
  chainId: t.integer().notNull(),
  latestBlock: t.bigint().notNull(), // Latest indexed block number
  lastUpdated: t.bigint().notNull(), // Timestamp of last update
}));