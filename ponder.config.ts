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
      address: "0x428B878cB6383216AaDc4e8495037E8d31612621",
      abi: FirstSqueezerNFTAbi as any,
      startBlock: 17129355,
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
      startBlock: 16900000,
      interval: 100,
    }
  }
});