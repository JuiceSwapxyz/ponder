import { createConfig } from "@ponder/core";
import { http } from "viem";
import { SwapRouter02Abi } from "./abis/SwapRouter02";
import { ERC20Abi } from "./abis/ERC20";

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
    // CITREA TESTNET - JuiceSwap V3 Routers (temporarily disabled for testing)
    // JuiceSwapRouter02_CitreaTestnet: {
    //   network: "citreaTestnet",
    //   address: "0x610c98EAD0df13EA906854b6041122e8A8D14413",
    //   abi: SwapRouter02Abi,
    //   startBlock: 15455029,
    //   includeCallTraces: true,
    // },
    // JuiceSwapRouter_CitreaTestnet: {
    //   network: "citreaTestnet",
    //   address: "0xb2A4E33e9A9aC7c46045A2D0318a4F50194dafDE",
    //   abi: SwapRouter02Abi,
    //   startBlock: 15455029,
    //   includeCallTraces: true,
    // },
    // JuiceSwapRouterAlt_CitreaTestnet: {
    //   network: "citreaTestnet",
    //   address: "0x3012E9049d05B4B5369D690114D5A5861EbB85cb",
    //   abi: SwapRouter02Abi,
    //   startBlock: 15455029,
    //   includeCallTraces: true,
    // },

    // CITREA TESTNET - Campaign Target Tokens
    NUSD_CitreaTestnet: {
      network: "citreaTestnet",
      address: "0x9B28B690550522608890C3C7e63c0b4A7eBab9AA",
      abi: ERC20Abi,
      filter: {
        event: "Transfer",
      },
      startBlock: 15455029,
    },
    cUSD_CitreaTestnet: {
      network: "citreaTestnet",
      address: "0x2fFC18aC99D367b70dd922771dF8c2074af4aCE0",
      abi: ERC20Abi,
      filter: {
        event: "Transfer",
      },
      startBlock: 15455029,
    },
    USDC_CitreaTestnet: {
      network: "citreaTestnet",
      address: "0x36c16eaC6B0Ba6c50f494914ff015fCa95B7835F",
      abi: ERC20Abi,
      filter: {
        event: "Transfer",
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