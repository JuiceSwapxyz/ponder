import { createConfig } from "@ponder/core";
import { http } from "viem";
import { SwapRouter02Abi } from "./abis/SwapRouter02";
import { ERC20Abi } from "./abis/ERC20";
import { UniswapV3PoolAbi } from "./abis/UniswapV3Pool";

export default createConfig({
  networks: {
    // Citrea Testnet (starting chain)
    citreaTestnet: {
      chainId: 5115,
      transport: http("https://rpc.testnet.citrea.xyz"),
    },
    // Citrea Mainnet (future)
    citrea: {
      chainId: 62298, // Citrea Mainnet Chain ID
      transport: http("https://rpc.citrea.xyz"),
    },
    // Ethereum Mainnet (future)
    ethereum: {
      chainId: 1,
      transport: http(process.env.ETHEREUM_RPC_URL || "https://ethereum-rpc.publicnode.com"),
    },
    // Sepolia Testnet (future)
    sepolia: {
      chainId: 11155111,
      transport: http(process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com"),
    },
  },
  contracts: {
    // CITREA TESTNET - UniswapV3 Pool Contracts for Citrea bApps Campaign
    CBTCNUSDPool_CitreaTestnet: {
      network: "citreaTestnet",
      address: "0x6006797369E2A595D31Df4ab3691044038AAa7FE",
      abi: UniswapV3PoolAbi,
      filter: {
        event: "Swap",
      },
      startBlock: 15455029,
    },
    CBTCcUSDPool_CitreaTestnet: {
      network: "citreaTestnet",
      address: "0xA69De906B9A830Deb64edB97B2eb0848139306d2",
      abi: UniswapV3PoolAbi,
      filter: {
        event: "Swap",
      },
      startBlock: 15455029,
    },
    CBTCUSDCPool_CitreaTestnet: {
      network: "citreaTestnet",
      address: "0xD8C7604176475eB8D350bC1EE452dA4442637C09",
      abi: UniswapV3PoolAbi,
      filter: {
        event: "Swap",
      },
      startBlock: 15455029,
    },

    // ETHEREUM MAINNET - Uniswap V3 (future)
    // UniswapV3Router_Ethereum: {
    //   network: "ethereum",
    //   address: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
    //   abi: "./abis/SwapRouter02.json",
    //   startBlock: 12369621, // Uniswap V3 deployment
    // },

    // SEPOLIA TESTNET - Uniswap V3 (future)
    // UniswapV3Router_Sepolia: {
    //   network: "sepolia",
    //   address: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
    //   abi: "./abis/SwapRouter02.json",
    //   startBlock: 1000000,
    // },
  },
});