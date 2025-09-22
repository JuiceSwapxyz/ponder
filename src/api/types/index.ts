import { Request, Response } from 'express';

// Task definitions
export interface Task {
  id: number;
  name: string;
  description: string;
  outputToken: string;
  inputToken: string;
}

export interface ChainTasks {
  [chainId: number]: Task[];
}

// GraphQL response types
export interface TaskCompletionItem {
  taskId: number;
  completedAt: string;
  txHash: string;
  swapAmount: string;
  outputToken: string;
  blockNumber: string;
}

export interface TaskCompletionsResponse {
  taskCompletions?: {
    items: TaskCompletionItem[];
  };
}

export interface SwapData {
  txHash: string;
  chainId: number;
  blockNumber: string;
  blockTimestamp: string;
  from: string;
  to: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  isCampaignRelevant: boolean;
  campaignTaskId?: number;
  methodSignature: string;
}

export interface SwapResponse {
  swap: SwapData | null;
}

export interface TaskCompletion {
  taskId: number;
  completedAt: string;
  txHash: string;
}

export interface TaskCompletionResponse {
  taskCompletion: TaskCompletion | null;
}

// API Request/Response types
export interface CampaignProgressRequest {
  walletAddress: string;
  chainId: string;
}

export interface CheckSwapRequest {
  txHash: string;
  walletAddress: string;
  chainId: string;
}

export interface CompleteTaskRequest {
  walletAddress: string;
  taskId: string;
  txHash: string;
  chainId: string;
}

export interface TaskStatus {
  id: number;
  name: string;
  description: string;
  completed: boolean;
  completedAt: string | null;
  txHash: string | null;
  swapAmount: string | null;
  blockNumber: string | null;
}

export interface CampaignProgressResponse {
  walletAddress: string;
  chainId: number;
  tasks: TaskStatus[];
  totalTasks: number;
  completedTasks: number;
  progress: number;
  nftClaimed: boolean;
  claimTxHash: string | null;
}

export interface CheckSwapResponse {
  taskId: number | null;
  taskName?: string;
  status: 'not_found' | 'confirmed' | 'error';
  isValid: boolean;
  alreadyCompleted?: boolean;
  reason?: string;
  message?: string;
  confirmations?: number;
  details?: Record<string, unknown>;
}

export interface CompleteTaskResponse {
  success: boolean;
  message: string;
  taskId: number;
  walletAddress: string;
  txHash: string;
  updatedProgress: {
    completedTasks: number;
    totalTasks: number;
    progress: number;
  };
}

export interface ErrorResponse {
  error: string;
  code: string;
  details?: unknown;
}