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

// ============ JUICE POINTS — LP TRACKING ============

/**
 * Per-(chainId, wallet, tokenId) running USD-cent value of a single V3 NFT
 * LP position. Updated on every IncreaseLiquidity / DecreaseLiquidity. Used by
 * `lpPositionWallet` to aggregate per wallet.
 *
 * `usdCents` is the principal-anchored valuation defined in `lpValuation.ts`;
 * it is NOT mark-to-market and intentionally never goes negative (clamped at 0).
 */
export const lpPosition = onchainTable("lp_position", (t) => ({
  id: t.text().primaryKey(),         // {chainId}:{tokenId}
  chainId: t.integer().notNull(),
  tokenId: t.text().notNull(),
  owner: t.text().notNull(),         // checksum-case wallet that holds the NFT
  poolAddress: t.text().notNull(),
  usdCents: t.bigint().notNull(),
}));

/**
 * Per-(chainId, wallet) aggregate LP USD value across all whitelisted positions.
 * Maintained as a running sum so `points.ts` does one row lookup per address.
 *
 * `lastEventTimestamp` is the on-chain timestamp of the most recent LP event
 * for this wallet — used at READ time in `points.ts` to credit completed UTC
 * days that have elapsed since with no LP event (carry-forward logic).
 */
export const lpPositionWallet = onchainTable("lp_position_wallet", (t) => ({
  id: t.text().primaryKey(),         // {chainId}:{walletLower}
  chainId: t.integer().notNull(),
  walletAddress: t.text().notNull(), // checksum form (matches transactionSwap)
  usdCents: t.bigint().notNull(),
  lastEventTimestamp: t.bigint().notNull(),
}));

/**
 * Existence = "wallet held ≥ MIN_LIQUIDITY_USD_CENTS of LP throughout this
 * complete UTC day". One row per credited day per wallet. The LP handler
 * inserts a row for every fully-covered day between two consecutive LP events.
 *
 * COUNT(*) per wallet gives the historical credited-days total. The live tail
 * (days since `lastEventTimestamp` where the running value is still ≥ $10) is
 * computed at read time and added on top.
 */
export const lpDayCredit = onchainTable("lp_day_credit", (t) => ({
  id: t.text().primaryKey(),         // {chainId}:{walletLower}:{day}
  chainId: t.integer().notNull(),
  walletAddress: t.text().notNull(),
  day: t.bigint().notNull(),         // floor(timestamp / 86400)
}));

// ============ JUICE POINTS — DAILY BALANCE TRACKING ============

/**
 * Per-wallet running raw-token balance for the JUICE equity token. Updated
 * on every Transfer event involving the wallet (sender debited, recipient
 * credited; zero-address transfers are mints/burns and only touch one side).
 *
 * `balance` is in 18-decimal raw units. Convert to whole-JUICE in the API
 * layer (floor(balance / 10^19) gives the daily JP credit since 10 JUICE = 1 JP).
 */
export const juiceHoldWallet = onchainTable("juice_hold_wallet", (t) => ({
  id: t.text().primaryKey(),                    // {chainId}:{walletLower}
  chainId: t.integer().notNull(),
  walletAddress: t.text().notNull(),            // checksum form
  balance: t.bigint().notNull(),                // raw 18-decimal units
  lastEventTimestamp: t.bigint().notNull(),
}));

/**
 * Existence = "wallet held ≥ 10 JUICE (i.e. ≥ 1 JP/day worth) throughout
 * this complete UTC day". `minJuiceUnits` is the minimum whole-JUICE count
 * observed during the day — points credit = minJuiceUnits / 10. Min, not
 * mean, so a single moment below the threshold breaks the day (anti-exploit).
 */
export const juiceHoldDayCredit = onchainTable("juice_hold_day_credit", (t) => ({
  id: t.text().primaryKey(),                    // {chainId}:{walletLower}:{day}
  chainId: t.integer().notNull(),
  walletAddress: t.text().notNull(),
  day: t.bigint().notNull(),
  minJuiceUnits: t.bigint().notNull(),          // whole JUICE (floor of raw / 1e18)
}));

/**
 * Per-wallet running raw-token balance for svJUSD (savings vault receipt).
 * 1 svJUSD ≈ 1 JUSD ≈ $1 for the points math; the small protocol-fee drift
 * doesn't change the order of magnitude of the reward.
 */
export const savingsWallet = onchainTable("savings_wallet", (t) => ({
  id: t.text().primaryKey(),                    // {chainId}:{walletLower}
  chainId: t.integer().notNull(),
  walletAddress: t.text().notNull(),
  balance: t.bigint().notNull(),                // raw 18-decimal svJUSD units
  lastEventTimestamp: t.bigint().notNull(),
}));

export const savingsDayCredit = onchainTable("savings_day_credit", (t) => ({
  id: t.text().primaryKey(),                    // {chainId}:{walletLower}:{day}
  chainId: t.integer().notNull(),
  walletAddress: t.text().notNull(),
  day: t.bigint().notNull(),
  minJusdUnits: t.bigint().notNull(),           // whole JUSD (floor of raw / 1e18)
}));

/**
 * Per-Position-contract running minted principal (debt) on the JUSD Minting
 * Hub. The factory pattern in ponder.config.ts spawns one indexer per
 * Position; this table aggregates their state.
 */
export const lendingPosition = onchainTable("lending_position", (t) => ({
  id: t.text().primaryKey(),                    // {chainId}:{positionAddressLower}
  chainId: t.integer().notNull(),
  positionAddress: t.text().notNull(),
  owner: t.text().notNull(),                    // borrower (checksum)
  principalJusd: t.bigint().notNull(),          // raw 18-decimal JUSD units
}));

/**
 * Per-borrower aggregate: sum of `principalJusd` across all of the wallet's
 * open positions. Drives the daily JP credit at 5 JP per whole JUSD per day.
 */
export const lendingWallet = onchainTable("lending_wallet", (t) => ({
  id: t.text().primaryKey(),                    // {chainId}:{walletLower}
  chainId: t.integer().notNull(),
  walletAddress: t.text().notNull(),
  totalPrincipalJusd: t.bigint().notNull(),
  lastEventTimestamp: t.bigint().notNull(),
}));

export const lendingDayCredit = onchainTable("lending_day_credit", (t) => ({
  id: t.text().primaryKey(),                    // {chainId}:{walletLower}:{day}
  chainId: t.integer().notNull(),
  walletAddress: t.text().notNull(),
  day: t.bigint().notNull(),
  minJusdUnits: t.bigint().notNull(),           // whole JUSD (floor of raw / 1e18)
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
export const v2PoolStat = onchainTable("v2PoolStat", (t) => ({
  id: t.text().primaryKey(), // poolAddress-type-timestamp
  chainId: t.integer().notNull(),
  poolAddress: t.text().notNull(),
  timestamp: t.bigint().notNull(),
  txCount: t.integer().notNull(),
  volume0: t.bigint().notNull(),
  volume1: t.bigint().notNull(),
  type: t.text().notNull(), // "1h", "24h", "all-time"
}));

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

// ============ GOVERNANCE & SECURITY MONITORING ============

export const governorProposal = onchainTable("governorProposal", (t) => ({
  id: t.text().primaryKey(),         // {chainId}:{proposalId}
  chainId: t.integer().notNull(),
  proposalId: t.bigint().notNull(),
  proposer: t.hex().notNull(),
  target: t.hex().notNull(),
  calldata: t.text().notNull(),      // hex-encoded
  executeAfter: t.bigint().notNull(),
  description: t.text().notNull(),
  status: t.text().notNull(),        // "active" | "executed" | "vetoed"
  executedBy: t.hex(),
  vetoedBy: t.hex(),
  createdAtBlock: t.bigint().notNull(),
  createdAt: t.bigint().notNull(),
  txHash: t.hex().notNull(),
  resolvedAt: t.bigint(),
  resolvedTxHash: t.hex(),
}));

export const feeCollectorOwnerUpdate = onchainTable("feeCollectorOwnerUpdate", (t) => ({
  id: t.text().primaryKey(),         // {chainId}:{txHash}:{logIndex}
  chainId: t.integer().notNull(),
  newOwner: t.hex().notNull(),
  blockNumber: t.bigint().notNull(),
  blockTimestamp: t.bigint().notNull(),
  txHash: t.hex().notNull(),
}));

export const feeCollectorRouterUpdate = onchainTable("feeCollectorRouterUpdate", (t) => ({
  id: t.text().primaryKey(),
  chainId: t.integer().notNull(),
  oldRouter: t.hex().notNull(),
  newRouter: t.hex().notNull(),
  blockNumber: t.bigint().notNull(),
  blockTimestamp: t.bigint().notNull(),
  txHash: t.hex().notNull(),
}));

export const feeCollectorCollectorUpdate = onchainTable("feeCollectorCollectorUpdate", (t) => ({
  id: t.text().primaryKey(),
  chainId: t.integer().notNull(),
  oldCollector: t.hex().notNull(),
  newCollector: t.hex().notNull(),
  blockNumber: t.bigint().notNull(),
  blockTimestamp: t.bigint().notNull(),
  txHash: t.hex().notNull(),
}));

export const feeCollectorProtectionUpdate = onchainTable("feeCollectorProtectionUpdate", (t) => ({
  id: t.text().primaryKey(),
  chainId: t.integer().notNull(),
  twapPeriod: t.integer().notNull(),
  maxSlippageBps: t.bigint().notNull(),
  blockNumber: t.bigint().notNull(),
  blockTimestamp: t.bigint().notNull(),
  txHash: t.hex().notNull(),
}));

export const factoryOwnerChange = onchainTable("factoryOwnerChange", (t) => ({
  id: t.text().primaryKey(),
  chainId: t.integer().notNull(),
  oldOwner: t.hex().notNull(),
  newOwner: t.hex().notNull(),
  blockNumber: t.bigint().notNull(),
  blockTimestamp: t.bigint().notNull(),
  txHash: t.hex().notNull(),
}));

export const gatewayBridgedTokenRegistration = onchainTable("gatewayBridgedTokenRegistration", (t) => ({
  id: t.text().primaryKey(),
  chainId: t.integer().notNull(),
  token: t.hex().notNull(),
  bridge: t.hex().notNull(),
  registeredBy: t.hex().notNull(),
  decimals: t.integer().notNull(),
  blockNumber: t.bigint().notNull(),
  blockTimestamp: t.bigint().notNull(),
  txHash: t.hex().notNull(),
}));

export const oftBridgeEvent = onchainTable("oftBridgeEvent", (t) => ({
  id: t.text().primaryKey(),
  chainId: t.integer().notNull(),
  direction: t.text().notNull(),     // "sent" | "received"
  guid: t.hex().notNull(),
  remoteEid: t.integer().notNull(),  // dstEid (sent) or srcEid (received)
  userAddress: t.hex().notNull(),    // sender (sent) or receiver (received)
  amountSentLD: t.bigint(),          // only for "sent"
  amountReceivedLD: t.bigint().notNull(),
  tokenAddress: t.hex().notNull(),   // which OFT contract emitted this
  blockNumber: t.bigint().notNull(),
  blockTimestamp: t.bigint().notNull(),
  txHash: t.hex().notNull(),
}));
