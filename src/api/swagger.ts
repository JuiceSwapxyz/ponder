import { swaggerUI } from "@hono/swagger-ui";

export const swaggerConfig = {
  openapi: "3.0.0",
  info: {
    title: "JuiceSwap Ponder API",
    version: "1.0.6",
    description: "API for JuiceSwap DEX analytics and campaign tracking on Citrea Testnet",
    contact: {
      name: "JuiceSwap Team",
      url: "https://juiceswap.com",
      email: "dev@juiceswap.com"
    },
    license: {
      name: "MIT",
      url: "https://opensource.org/licenses/MIT"
    },
    "x-logo": {
      url: "https://juiceswap.com/logo.png",
      altText: "JuiceSwap Logo"
    }
  },
  servers: [
    {
      url: "https://ponder.juiceswap.com",
      description: "Production server"
    },
    {
      url: "http://localhost:42069",
      description: "Local development server"
    }
  ],
  tags: [
    {
      name: "Campaign",
      description: "Campaign tracking and progress endpoints"
    },
    {
      name: "Pools",
      description: "Liquidity pool information"
    },
    {
      name: "Positions",
      description: "Liquidity positions management"
    },
    {
      name: "Tokens",
      description: "Token information and analytics"
    },
    {
      name: "System",
      description: "System health and status endpoints"
    }
  ]
};

export const swaggerUIOptions = {
  url: "/api-docs"
};

export function getSwaggerUI() {
  return swaggerUI({ url: "/api-docs" });
}

export const apiDocumentation = {
  openapi: "3.0.0",
  info: {
    ...swaggerConfig.info,
    "x-build": {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development"
    }
  },
  servers: swaggerConfig.servers,
  tags: swaggerConfig.tags,
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Enter your Bearer token in the format: Bearer <token>"
      }
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: {
            type: "string",
            description: "Error message"
          },
          statusCode: {
            type: "integer",
            description: "HTTP status code"
          },
          timestamp: {
            type: "string",
            format: "date-time",
            description: "Timestamp of the error"
          }
        }
      },
      Task: {
        type: "object",
        properties: {
          id: { type: "number", example: 1 },
          name: { type: "string", example: "Swap cBTC to NUSD" },
          description: { type: "string" },
          completed: { type: "boolean" },
          completedAt: { type: "string", format: "date-time", nullable: true },
          txHash: { type: "string", nullable: true }
        }
      },
      CampaignProgress: {
        type: "object",
        properties: {
          walletAddress: { type: "string", example: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb" },
          chainId: { type: "number", example: 5115 },
          tasks: {
            type: "array",
            items: { "$ref": "#/components/schemas/Task" }
          },
          totalTasks: { type: "number", example: 3 },
          completedTasks: { type: "number", example: 1 },
          progress: { type: "number", example: 33.33 },
          nftClaimed: { type: "boolean" },
          claimTxHash: { type: "string", nullable: true }
        }
      }
    }
  },
  externalDocs: {
    description: "GitHub Repository",
    url: "https://github.com/JuiceSwapxyz/ponder"
  },
  paths: {
    "/campaign/progress": {
      get: {
        tags: ["Campaign"],
        summary: "Get campaign progress for a wallet",
        description: "Returns task completion status and progress for a specific wallet address",
        parameters: [
          {
            name: "walletAddress",
            in: "query",
            required: true,
            description: "Ethereum wallet address",
            schema: {
              type: "string",
              example: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
            }
          },
          {
            name: "chainId",
            in: "query",
            required: true,
            description: "Chain ID (only 5115 for Citrea Testnet supported)",
            schema: {
              type: "integer",
              example: 5115
            }
          }
        ],
        responses: {
          200: {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    walletAddress: { type: "string" },
                    chainId: { type: "number" },
                    tasks: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "number" },
                          name: { type: "string" },
                          description: { type: "string" },
                          completed: { type: "boolean" },
                          completedAt: { type: "string", nullable: true },
                          txHash: { type: "string", nullable: true }
                        }
                      }
                    },
                    totalTasks: { type: "number" },
                    completedTasks: { type: "number" },
                    progress: { type: "number" },
                    nftClaimed: { type: "boolean" },
                    claimTxHash: { type: "string", nullable: true }
                  }
                }
              }
            }
          },
          400: {
            description: "Bad Request",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ["Campaign"],
        summary: "Get campaign progress for a wallet (POST)",
        description: "POST version of the campaign progress endpoint for compatibility",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["walletAddress", "chainId"],
                properties: {
                  walletAddress: {
                    type: "string",
                    description: "Ethereum wallet address",
                    example: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
                  },
                  chainId: {
                    type: "integer",
                    description: "Chain ID",
                    example: 5115
                  }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    walletAddress: { type: "string" },
                    chainId: { type: "number" },
                    tasks: { type: "array" },
                    totalTasks: { type: "number" },
                    completedTasks: { type: "number" },
                    progress: { type: "number" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/campaign/addresses": {
      get: {
        tags: ["Campaign"],
        summary: "Get all addresses with campaign progress",
        description: "Returns list of all wallet addresses that have participated in the campaign",
        parameters: [
          {
            name: "chainId",
            in: "query",
            description: "Chain ID (defaults to 5115)",
            schema: {
              type: "integer",
              default: 5115
            }
          }
        ],
        responses: {
          200: {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      walletAddress: { type: "string" },
                      completedTasks: { type: "number" }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/campaign/stats": {
      get: {
        tags: ["Campaign"],
        summary: "Get campaign statistics",
        description: "Returns overall campaign participation statistics",
        parameters: [
          {
            name: "chainId",
            in: "query",
            description: "Chain ID (defaults to 5115)",
            schema: {
              type: "integer",
              default: 5115
            }
          }
        ],
        responses: {
          200: {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    totalParticipants: { type: "number" },
                    completedAllTasks: { type: "number" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/campaign/health": {
      get: {
        tags: ["Campaign"],
        summary: "Campaign API health check",
        description: "Check campaign API service health",
        responses: {
          200: {
            description: "Service is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "OK" },
                    timestamp: { type: "string" },
                    chains: { type: "array", items: { type: "string" } },
                    features: { type: "array", items: { type: "string" } },
                    version: { type: "string" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/info": {
      get: {
        tags: ["System"],
        summary: "API information",
        description: "Get general API and contract information",
        responses: {
          200: {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    version: { type: "string" },
                    chain: { type: "string" },
                    contracts: {
                      type: "object",
                      properties: {
                        CBTCNUSDPool: { type: "string" },
                        CBTCcUSDPool: { type: "string" },
                        CBTCUSDCPool: { type: "string" }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/sync-status": {
      get: {
        tags: ["System"],
        summary: "Get blockchain sync status",
        description: "Returns current synchronization status of the indexer",
        responses: {
          200: {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string" },
                    timestamp: { type: "string" },
                    sync: {
                      type: "object",
                      properties: {
                        latestIndexedBlock: { type: "number" },
                        currentChainBlock: { type: "number" },
                        blocksBehind: { type: "number" },
                        syncPercentage: { type: "number" },
                        status: { type: "string", enum: ["synced", "syncing"] }
                      }
                    },
                    stats: {
                      type: "object",
                      properties: {
                        swaps: { type: "number" },
                        pools: { type: "number" },
                        positions: { type: "number" }
                      }
                    }
                  }
                }
              }
            }
          },
          500: {
            description: "Internal Server Error",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string" },
                    error: { type: "string" },
                    timestamp: { type: "string" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/pools": {
      get: {
        tags: ["Pools"],
        summary: "Get all pools",
        description: "Returns list of all liquidity pools",
        responses: {
          200: {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      poolAddress: { type: "string" },
                      token0: { type: "string" },
                      token1: { type: "string" },
                      fee: { type: "number" },
                      liquidity: { type: "string" },
                      volume24h: { type: "string" }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/pools/{poolAddress}": {
      get: {
        tags: ["Pools"],
        summary: "Get pool by address",
        description: "Returns information about a specific liquidity pool",
        parameters: [
          {
            name: "poolAddress",
            in: "path",
            required: true,
            description: "Pool contract address",
            schema: {
              type: "string"
            }
          }
        ],
        responses: {
          200: {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    poolAddress: { type: "string" },
                    token0: { type: "string" },
                    token1: { type: "string" },
                    fee: { type: "number" },
                    liquidity: { type: "string" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/positions/{owner}": {
      get: {
        tags: ["Positions"],
        summary: "Get positions by owner",
        description: "Returns all positions for a specific owner",
        parameters: [
          {
            name: "owner",
            in: "path",
            required: true,
            description: "Owner wallet address",
            schema: {
              type: "string"
            }
          }
        ],
        responses: {
          200: {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      positionId: { type: "string" },
                      owner: { type: "string" },
                      poolAddress: { type: "string" },
                      liquidity: { type: "string" },
                      tickLower: { type: "number" },
                      tickUpper: { type: "number" }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/tokens": {
      get: {
        tags: ["Tokens"],
        summary: "Get all tokens",
        description: "Returns list of all tokens in the system",
        responses: {
          200: {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      address: { type: "string" },
                      symbol: { type: "string" },
                      name: { type: "string" },
                      decimals: { type: "number" }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/graphql": {
      post: {
        tags: ["System"],
        summary: "GraphQL endpoint",
        description: "Execute GraphQL queries against the Ponder database",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  query: {
                    type: "string",
                    description: "GraphQL query"
                  },
                  variables: {
                    type: "object",
                    description: "GraphQL variables"
                  }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: "Success",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "object" },
                    errors: { type: "array" }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};