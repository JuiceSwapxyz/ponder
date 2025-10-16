import { createConfig, factory, rateLimit } from "ponder";
import { UniswapV3PoolAbi } from "./abis/UniswapV3Pool";
import { FirstSqueezerNFTAbi } from "./abis/FirstSqueezerNFT";
import { citreaTransport } from "./citrea-transport-fix";
import { NonfungiblePositionManagerAbi } from "./abis/NonfungiblePositionManager";
import { UniswapV3FactoryAbi } from "./abis/UniswapV3Factory";
import { parseAbiItem } from "viem";

export default createConfig({
  chains: {
    // Citrea Testnet
    citreaTestnet: {
      id: 5115,
      rpc: rateLimit(citreaTransport(process.env.CITREA_RPC_URL ?? "https://rpc.testnet.juiceswap.com/"), {
        requestsPerSecond: 40
      }),
    },
  },
  contracts: {
    // CITREA TESTNET - First Squeezer NFT Campaign
    FirstSqueezerNFT: {
      chain: "citreaTestnet",
      address: "0xcF62B46fF36a6FcABf4C0056c535A0cA41E7c03b",
      abi: FirstSqueezerNFTAbi as any,
      filter: {
        event: "NFTClaimed",
        args: {},
      } as any,
      startBlock: 16280000,
    },
    // CITREA TESTNET - UniswapV3 Pool Contracts for Citrea bApps Campaign
    CBTCNUSDPool_CitreaTestnet: {
      chain: "citreaTestnet",
      address: "0x6006797369E2A595D31Df4ab3691044038AAa7FE",
      abi: UniswapV3PoolAbi as any,
      filter: {
        event: "Swap",
        args: {},
      } as any,
      startBlock: 15805014,
    },
    CBTCcUSDPool_CitreaTestnet: {
      chain: "citreaTestnet",
      address: "0xA69De906B9A830Deb64edB97B2eb0848139306d2",
      abi: UniswapV3PoolAbi as any,
      filter: {
        event: "Swap",
        args: {},
      } as any,
      startBlock: 15615173,
    },
    CBTCUSDCPool_CitreaTestnet: {
      chain: "citreaTestnet",
      address: "0xD8C7604176475eB8D350bC1EE452dA4442637C09",
      abi: UniswapV3PoolAbi as any,
      filter: {
        event: "Swap",
        args: {},
      } as any,
      startBlock: 15804939,
    },
    NonfungiblePositionManager: {
      chain: "citreaTestnet",
      address: "0xe46616BED47317653EE3B7794fC171F4444Ee1c5",
      abi: NonfungiblePositionManagerAbi as any,
      startBlock: 15455019,
    },
    UniswapV3Factory: {
      chain: "citreaTestnet",
      address: "0x6832283eEA5a9A3C4384A5D9a06Db0ce6FE9C79E",
      abi: UniswapV3FactoryAbi as any,
      startBlock: 15455001,
    },
    UniswapV3Pool: {
      chain: "citreaTestnet",
      abi: UniswapV3PoolAbi as any,
      startBlock: 15455001,
      address: factory({
        address: "0x6832283eEA5a9A3C4384A5D9a06Db0ce6FE9C79E",
        event: parseAbiItem('event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)'),
        parameter: "pool",
      })
    }
  },
  blocks: {
    blockProgress: {
      chain: "citreaTestnet",
      startBlock: 15455001,
      interval: 1,
    }
  }
});