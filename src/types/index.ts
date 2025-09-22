import { Address, Hash, Hex } from "viem";

// Transaction types
export interface TransactionEvent {
  transaction: {
    hash: Hash;
    from: Address;
    to: Address | null;
    value: bigint;
    input: Hex;
  };
}

export interface TransactionLog {
  address: Address;
  topics: Hex[];
  data: Hex;
}

export interface TransactionReceipt {
  logs: TransactionLog[];
  status: "success" | "reverted";
  transactionHash: Hash;
  blockNumber: bigint;
  gasUsed: bigint;
}

// Context types
export interface BlockContext {
  number: bigint;
  timestamp: bigint;
  hash: Hash;
}

export interface ClientContext {
  getTransactionReceipt: (args: { hash: Hash }) => Promise<TransactionReceipt>;
}

export interface DatabaseContext {
  swap: {
    create: (args: { id: string; data: SwapData }) => Promise<void>;
    count: (args: { where: Partial<SwapData> }) => Promise<number>;
    findMany: (args: { where: Partial<SwapData> }) => Promise<SwapData[]>;
  };
  campaignProgress: {
    upsert: (args: {
      id: string;
      create: CampaignProgressData;
      update: Partial<CampaignProgressData>;
    }) => Promise<void>;
    count: (args: { where: Partial<CampaignProgressData> }) => Promise<number>;
  };
  taskCompletion: {
    upsert: (args: {
      id: string;
      create: TaskCompletionData;
      update: Partial<TaskCompletionData>;
    }) => Promise<void>;
    count: (args: { where: Partial<TaskCompletionData> }) => Promise<number>;
  };
  campaignStats: {
    upsert: (args: {
      id: string;
      create: CampaignStatsData;
      update: Partial<CampaignStatsData>;
    }) => Promise<void>;
  };
  token: {
    upsert: (args: {
      id: string;
      create: TokenData;
      update: Partial<TokenData>;
    }) => Promise<void>;
  };
}

export interface PonderContext {
  block: BlockContext;
  client: ClientContext;
  db: DatabaseContext;
}

// Data types
export interface SwapData {
  txHash: Hash;
  chainId: number;
  blockNumber: bigint;
  blockTimestamp: bigint;
  from: Address;
  to: Address;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  amountOut: bigint;
  router: Address;
  methodSignature: string;
  isCampaignRelevant: boolean;
  campaignTaskId?: number;
}

export interface CampaignProgressData {
  walletAddress: Address;
  chainId: number;
  createdAt: bigint;
  updatedAt: bigint;
}

export interface TaskCompletionData {
  walletAddress: Address;
  chainId: number;
  taskId: number;
  txHash: Hash;
  completedAt: bigint;
  swapAmount: bigint;
  inputToken: Address;
  outputToken: Address;
  blockNumber: bigint;
}

export interface CampaignStatsData {
  chainId: number;
  totalUsers: number;
  totalSwaps: number;
  totalVolume: bigint;
  task1Completions: number;
  task2Completions: number;
  task3Completions: number;
  lastUpdated: bigint;
}

export interface TokenData {
  address: Address;
  chainId: number;
  symbol: string;
  name: string;
  decimals: number;
  isCampaignToken: boolean;
  campaignTaskId?: number;
}

export interface CampaignToken {
  taskId: number;
  symbol: string;
}

export interface SwapAnalysisResult {
  txHash: Hash;
  chainId: number;
  blockNumber: bigint;
  blockTimestamp: bigint;
  from: Address;
  to: Address;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  amountOut: bigint;
  router: Address;
  methodSignature: string;
}