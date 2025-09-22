import { Request, Response } from 'express';
import { GraphQLClient } from 'graphql-request';

// Multi-Chain Task definitions
const CHAIN_TASKS = {
  // Citrea Testnet
  5115: [
    {
      id: 1,
      name: "Swap cBTC to NUSD",
      description: "Complete a swap from cBTC to NUSD",
      outputToken: "0x9B28B690550522608890C3C7e63c0b4A7eBab9AA",
      inputToken: "cBTC"
    },
    {
      id: 2,
      name: "Swap cBTC to cUSD",
      description: "Complete a swap from cBTC to cUSD",
      outputToken: "0x2fFC18aC99D367b70dd922771dF8c2074af4aCE0",
      inputToken: "cBTC"
    },
    {
      id: 3,
      name: "Swap cBTC to USDC",
      description: "Complete a swap from cBTC to USDC",
      outputToken: "0x36c16eaC6B0Ba6c50f494914ff015fCa95B7835F",
      inputToken: "cBTC"
    }
  ],
  // Citrea Mainnet (TODO: Add actual mainnet tasks)
  62298: [
    // Same structure as testnet once addresses are known
  ],
  // Ethereum Mainnet
  1: [
    {
      id: 1,
      name: "Swap ETH to USDT",
      description: "Complete a swap from ETH to USDT",
      outputToken: "0xA0b86a33E6417C00A2C62cc0ebe71a7C30c7e54D",
      inputToken: "ETH"
    },
    {
      id: 2,
      name: "Swap ETH to USDT",
      description: "Complete a swap from ETH to USDT",
      outputToken: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      inputToken: "ETH"
    },
    {
      id: 3,
      name: "Swap ETH to USDC",
      description: "Complete a swap from ETH to USDC",
      outputToken: "0xA0b1C33E6417C00A5C62c1c0ebe71a7C30c7e54D",
      inputToken: "ETH"
    }
  ],
  // Sepolia Testnet
  11155111: [
    {
      id: 1,
      name: "Swap ETH to WETH",
      description: "Complete a swap from ETH to WETH",
      outputToken: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
      inputToken: "ETH"
    },
    {
      id: 2,
      name: "Swap ETH to USDC",
      description: "Complete a swap from ETH to USDC",
      outputToken: "0xf531B8F309Be94191af87605CfBf600D71C2cFe0",
      inputToken: "ETH"
    },
    {
      id: 3,
      name: "Swap ETH to USDT",
      description: "Complete a swap from ETH to USDT",
      outputToken: "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8",
      inputToken: "ETH"
    }
  ]
};

// Helper function to get tasks for a specific chain
function getTasksForChain(chainId: number) {
  return CHAIN_TASKS[chainId as keyof typeof CHAIN_TASKS] || [];
}

// GraphQL client to query Ponder's API
const graphqlClient = new GraphQLClient(process.env.PONDER_GRAPHQL_URL || 'http://localhost:42069/graphql');

export async function getCampaignProgress(req: Request, res: Response) {
  try {
    const { walletAddress, chainId } = req.body;

    if (!walletAddress || !chainId) {
      return res.status(400).json({
        error: 'Missing required fields: walletAddress, chainId',
        code: 'MISSING_FIELDS'
      });
    }

    // Query Ponder for user's task completions
    const query = `
      query GetUserProgress($walletAddress: String!, $chainId: Int!) {
        taskCompletions(
          where: {
            walletAddress: $walletAddress,
            chainId: $chainId
          }
        ) {
          items {
            taskId
            completedAt
            txHash
            swapAmount
            outputToken
            blockNumber
          }
        }
      }
    `;

    const data = await graphqlClient.request(query, {
      walletAddress: walletAddress.toLowerCase(),
      chainId: parseInt(chainId)
    });

    // Get tasks for this specific chain
    const chainTasks = getTasksForChain(parseInt(chainId));

    if (chainTasks.length === 0) {
      return res.status(400).json({
        error: `No campaign tasks configured for chain ${chainId}`,
        code: 'CHAIN_NOT_SUPPORTED'
      });
    }

    // Build response with all tasks and their status
    const completedTasks = data.taskCompletions?.items || [];
    const tasks = chainTasks.map(task => {
      const completed = completedTasks.find((t: any) => t.taskId === task.id);
      return {
        id: task.id,
        name: task.name,
        description: task.description,
        completed: !!completed,
        completedAt: completed?.completedAt ? new Date(Number(completed.completedAt) * 1000).toISOString() : null,
        txHash: completed?.txHash || null,
        swapAmount: completed?.swapAmount || null,
        blockNumber: completed?.blockNumber?.toString() || null
      };
    });

    const completedCount = tasks.filter(t => t.completed).length;

    res.json({
      walletAddress,
      chainId: parseInt(chainId),
      tasks,
      totalTasks: chainTasks.length,
      completedTasks: completedCount,
      progress: (completedCount / chainTasks.length) * 100,
      nftClaimed: false,
      claimTxHash: null
    });
  } catch (error) {
    console.error('Error getting campaign progress:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
}

export async function checkSwapTransaction(req: Request, res: Response) {
  try {
    const { txHash, walletAddress, chainId } = req.body;

    if (!txHash || !walletAddress || !chainId) {
      return res.status(400).json({
        error: 'Missing required fields: txHash, walletAddress, chainId',
        code: 'MISSING_FIELDS'
      });
    }

    console.log(`📨 Checking swap transaction: ${txHash}`);
    console.log(`   Wallet: ${walletAddress}`);
    console.log(`   Chain: ${chainId}`);

    // Query Ponder for the specific swap transaction
    const swapQuery = `
      query GetSwap($txHash: String!) {
        swap(id: $txHash) {
          txHash
          chainId
          blockNumber
          blockTimestamp
          from
          to
          tokenIn
          tokenOut
          amountIn
          amountOut
          isCampaignRelevant
          campaignTaskId
          methodSignature
        }
      }
    `;

    const swapData = await graphqlClient.request(swapQuery, {
      txHash: txHash.toLowerCase()
    });

    const swap = swapData.swap;

    // If swap not found, it might not be indexed yet or invalid
    if (!swap) {
      return res.json({
        taskId: null,
        status: 'not_found',
        isValid: false,
        reason: 'Transaction not found or not indexed yet',
        message: 'Transaction may not be submitted yet, still pending, or invalid hash',
      });
    }

    // Check if wallet address matches
    if (swap.from.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.json({
        taskId: null,
        status: 'confirmed',
        isValid: false,
        reason: 'Transaction was not initiated by the specified wallet address',
        details: {
          expectedWallet: walletAddress,
          actualWallet: swap.from
        }
      });
    }

    // Check if chain ID matches
    if (swap.chainId !== parseInt(chainId)) {
      return res.json({
        taskId: null,
        status: 'confirmed',
        isValid: false,
        reason: 'Transaction is not on the specified chain',
        details: {
          expectedChain: parseInt(chainId),
          actualChain: swap.chainId
        }
      });
    }

    // Check if this is a campaign-relevant swap
    if (!swap.isCampaignRelevant) {
      return res.json({
        taskId: null,
        status: 'confirmed',
        isValid: false,
        reason: 'Swap does not match any campaign tasks (must be cBTC to campaign token)',
        details: {
          inputToken: swap.tokenIn,
          outputToken: swap.tokenOut,
          expectedInputToken: '0x0000000000000000000000000000000000000000' // Native token (cBTC)
        }
      });
    }

    // Get tasks for this specific chain
    const chainTasks = getTasksForChain(parseInt(chainId));

    // Find matching task
    const matchingTask = chainTasks.find(
      t => t.outputToken.toLowerCase() === swap.tokenOut.toLowerCase()
    );

    if (!matchingTask) {
      return res.json({
        taskId: null,
        status: 'confirmed',
        isValid: false,
        reason: 'Swap output token does not match any campaign tasks',
        details: {
          outputToken: swap.tokenOut,
          expectedTokens: chainTasks.map(t => ({ id: t.id, name: t.name, token: t.outputToken }))
        }
      });
    }

    // Check if task is already completed
    const completionQuery = `
      query GetTaskCompletion($walletAddress: String!, $chainId: Int!, $taskId: Int!) {
        taskCompletion(id: "${chainId}:${walletAddress.toLowerCase()}:${matchingTask.id}") {
          taskId
          completedAt
          txHash
        }
      }
    `;

    const completionData = await graphqlClient.request(completionQuery, {
      walletAddress: walletAddress.toLowerCase(),
      chainId: parseInt(chainId),
      taskId: matchingTask.id
    });

    const isAlreadyCompleted = !!completionData.taskCompletion;

    // Success! Task matches
    console.log(`✅ Task ${matchingTask.id} (${matchingTask.name}) validated!`);

    res.json({
      taskId: matchingTask.id,
      taskName: matchingTask.name,
      status: 'confirmed',
      isValid: true,
      alreadyCompleted: isAlreadyCompleted,
      confirmations: 1, // Ponder only indexes confirmed transactions
      details: {
        inputToken: 'cBTC',
        outputToken: matchingTask.name.split(' to ')[1],
        outputAddress: swap.tokenOut,
        amountIn: swap.amountIn.toString(),
        amountOut: swap.amountOut.toString(),
        timestamp: new Date(Number(swap.blockTimestamp) * 1000).toISOString(),
        blockNumber: swap.blockNumber.toString(),
        router: swap.to,
        methodSignature: swap.methodSignature
      }
    });
  } catch (error) {
    console.error('Error checking swap transaction:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR',
      status: 'error'
    });
  }
}

export async function completeTask(req: Request, res: Response) {
  try {
    const { walletAddress, taskId, txHash, chainId } = req.body;

    if (!walletAddress || !taskId || !txHash || !chainId) {
      return res.status(400).json({
        error: 'Missing required fields: walletAddress, taskId, txHash, chainId',
        code: 'MISSING_FIELDS'
      });
    }

    // First, verify the transaction is valid for this task
    const checkResult = await checkSwapTransaction({
      body: { txHash, walletAddress, chainId }
    } as Request, {
      json: (data: any) => data
    } as any);

    // If the check didn't return a valid result, forward the error
    if (!checkResult.isValid) {
      return res.status(400).json({
        error: 'Transaction validation failed',
        code: 'INVALID_TRANSACTION',
        details: checkResult
      });
    }

    // Check if the task ID matches
    if (checkResult.taskId !== parseInt(taskId)) {
      return res.status(400).json({
        error: 'Transaction does not match the specified task',
        code: 'WRONG_TASK',
        details: {
          expectedTaskId: parseInt(taskId),
          actualTaskId: checkResult.taskId
        }
      });
    }

    // Check if already completed
    if (checkResult.alreadyCompleted) {
      return res.status(400).json({
        error: 'Task already completed',
        code: 'TASK_ALREADY_COMPLETED',
        taskId: parseInt(taskId)
      });
    }

    // Note: Task completion is automatically handled by Ponder indexing
    // when the swap transaction is processed. We just need to confirm it exists.

    // Get updated progress
    const progressResult = await getCampaignProgress({
      body: { walletAddress, chainId }
    } as Request, {
      json: (data: any) => data
    } as any);

    res.json({
      success: true,
      message: 'Task completed successfully',
      taskId: parseInt(taskId),
      walletAddress,
      txHash,
      updatedProgress: {
        completedTasks: progressResult.completedTasks,
        totalTasks: progressResult.totalTasks,
        progress: progressResult.progress
      }
    });
  } catch (error) {
    console.error('Error completing task:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
}