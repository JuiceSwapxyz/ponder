import { createConfig, factory, rateLimit } from "ponder";
import { UniswapV3PoolAbi } from "./abis/UniswapV3Pool";
import { FirstSqueezerNFTAbi } from "./abis/FirstSqueezerNFT";
import { citreaTransport } from "./citrea-transport-fix";
import { NonfungiblePositionManagerAbi } from "./abis/NonfungiblePositionManager";
import { UniswapV3FactoryAbi } from "./abis/UniswapV3Factory";
import { TokenFactoryAbi } from "./abis/TokenFactory";
import { BondingCurveTokenAbi } from "./abis/BondingCurveToken";
import { ADDRESS as LAUNCHPAD_ADDRESSES } from "@juiceswapxyz/launchpad";
import { CHAIN_TO_ADDRESSES_MAP, ChainId } from "@juiceswapxyz/sdk-core";
import { parseAbiItem } from "viem";

// V3 addresses from sdk-core (single source of truth)
const V3_ADDRESSES = CHAIN_TO_ADDRESSES_MAP[ChainId.CITREA_TESTNET];

// Launchpad deployment block (Citrea Testnet)
const LAUNCHPAD_START_BLOCK = 20411368;

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
      address: V3_ADDRESSES.nonfungiblePositionManagerAddress as `0x${string}`,
      abi: NonfungiblePositionManagerAbi as any,
      startBlock: 19289932,
    },
    UniswapV3Factory: {
      chain: "citreaTestnet",
      address: V3_ADDRESSES.v3CoreFactoryAddress as `0x${string}`,
      abi: UniswapV3FactoryAbi as any,
      startBlock: 19289882,
    },
    UniswapV3Pool: {
      chain: "citreaTestnet",
      abi: UniswapV3PoolAbi as any,
      startBlock: 19289882,
      address: factory({
        address: V3_ADDRESSES.v3CoreFactoryAddress as `0x${string}`,
        event: parseAbiItem('event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)'),
        parameter: "pool",
      })
    },
    // CITREA TESTNET - Launchpad (Bonding Curve Token Factory)
    TokenFactory: {
      chain: "citreaTestnet",
      address: LAUNCHPAD_ADDRESSES[5115].factory as `0x${string}`,
      abi: TokenFactoryAbi as any,
      startBlock: LAUNCHPAD_START_BLOCK,
    },
    BondingCurveToken: {
      chain: "citreaTestnet",
      abi: BondingCurveTokenAbi as any,
      startBlock: LAUNCHPAD_START_BLOCK,
      address: factory({
        address: LAUNCHPAD_ADDRESSES[5115].factory as `0x${string}`,
        event: parseAbiItem('event TokenCreated(address indexed token, address indexed creator, string name, string symbol, address baseAsset, uint256 initialVirtualBaseReserves, address feeRecipient, string metadataURI)'),
        parameter: "token",
      })
    }
  },
  blocks: {
    blockProgress: {
      chain: "citreaTestnet",
      startBlock: 19289882,
      interval: 100,
    }
  }
});