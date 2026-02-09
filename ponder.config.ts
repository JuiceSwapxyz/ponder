import { createConfig, factory, rateLimit } from "ponder";
import { UniswapV3PoolAbi } from "./abis/UniswapV3Pool";
import { FirstSqueezerNFTAbi } from "./abis/FirstSqueezerNFT";
import { citreaTransport } from "./citrea-transport-fix";
import { NonfungiblePositionManagerAbi } from "./abis/NonfungiblePositionManager";
import { UniswapV3FactoryAbi } from "./abis/UniswapV3Factory";
import { TokenFactoryAbi } from "./abis/TokenFactory";
import { BondingCurveTokenAbi } from "./abis/BondingCurveToken";
import { UniswapV2PairAbi } from "./abis/UniswapV2Pair";
import { JuiceSwapGovernorAbi } from "./abis/JuiceSwapGovernor";
import { JuiceSwapFeeCollectorAbi } from "./abis/JuiceSwapFeeCollector";
import { JuiceSwapGatewayAbi } from "./abis/JuiceSwapGateway";
import { LayerZeroOFTAbi } from "./abis/LayerZeroOFT";
import { ADDRESS as LAUNCHPAD_ADDRESSES } from "@juiceswapxyz/launchpad";
import { CHAIN_TO_ADDRESSES_MAP, ChainId, V2_FACTORY_ADDRESSES } from "@juiceswapxyz/sdk-core";
import { parseAbiItem } from "viem";

const LAUNCHPAD_TESTNET_ADDRESSES = LAUNCHPAD_ADDRESSES[5115];
const LAUNCHPAD_MAINNET_ADDRESSES = LAUNCHPAD_ADDRESSES[4114];
const START_BLOCK_LAUNCHPAD_TESTNET = 21252514;
const START_BLOCK_LAUNCHPAD_MAINNET = 2652915;

const V3_TESTNET_ADDRESSES = CHAIN_TO_ADDRESSES_MAP[ChainId.CITREA_TESTNET];
const V3_MAINNET_ADDRESSES = CHAIN_TO_ADDRESSES_MAP[ChainId.CITREA_MAINNET];
const START_BLOCK_TESTNET = 21252514;
const START_BLOCK_MAINNET = 2651625;

export default createConfig({
  chains: {
    citreaTestnet: {
      id: 5115,
      rpc: rateLimit(citreaTransport(process.env.CITREA_5115_RPC_URL ?? "https://dev.rpc.testnet.juiceswap.com/"), {
        requestsPerSecond: 40
      }),
    },
    citrea: {
      id: 4114,
      rpc: rateLimit(citreaTransport(process.env.CITREA_4114_RPC_URL ?? "https://rpc.citreascan.com/"), {
        requestsPerSecond: 40
      }),
    }
  },
  contracts: {
    FirstSqueezerNFT: {
      abi: FirstSqueezerNFTAbi as any,
      chain: "citreaTestnet",
      address: "0x428B878cB6383216AaDc4e8495037E8d31612621",
      startBlock: "latest",
    },
    NonfungiblePositionManager: {
      abi: NonfungiblePositionManagerAbi as any,
      chain: {
        citreaTestnet: {
          address: V3_TESTNET_ADDRESSES.nonfungiblePositionManagerAddress as `0x${string}`,
          startBlock: START_BLOCK_TESTNET,
        },
        citrea: {
          address: V3_MAINNET_ADDRESSES.nonfungiblePositionManagerAddress as `0x${string}`,
          startBlock: START_BLOCK_MAINNET,
        }
      }
    },
    UniswapV3Factory: {
      abi: UniswapV3FactoryAbi as any,
      chain: {
        citreaTestnet: {
          address: V3_TESTNET_ADDRESSES.v3CoreFactoryAddress as `0x${string}`,
          startBlock: START_BLOCK_TESTNET,
        },
        citrea: {
          address: V3_MAINNET_ADDRESSES.v3CoreFactoryAddress as `0x${string}`,
          startBlock: START_BLOCK_MAINNET,
        }
      },
    },
    UniswapV3Pool: {
      abi: UniswapV3PoolAbi as any,
      chain: {
        citreaTestnet: {
          startBlock: START_BLOCK_TESTNET,
          address: factory({
            address: V3_TESTNET_ADDRESSES.v3CoreFactoryAddress as `0x${string}`,
            event: parseAbiItem('event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)'),
            parameter: "pool",
          })
        },
        citrea: {
          startBlock: START_BLOCK_MAINNET,
          address: factory({
            address: V3_MAINNET_ADDRESSES.v3CoreFactoryAddress as `0x${string}`,
            event: parseAbiItem('event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)'),
            parameter: "pool",
          })
        }
      },
    },
    TokenFactory: {
      abi: TokenFactoryAbi as any,
      chain: {
        citreaTestnet: {
          address: LAUNCHPAD_TESTNET_ADDRESSES.factory as `0x${string}`,
          startBlock: START_BLOCK_LAUNCHPAD_TESTNET,
        },
        citrea: {
          address: LAUNCHPAD_MAINNET_ADDRESSES.factory as `0x${string}`,
          startBlock: START_BLOCK_LAUNCHPAD_MAINNET,
        },
      },
    },
    BondingCurveToken: {
      abi: BondingCurveTokenAbi as any,
      chain: {
        citreaTestnet: {
          startBlock: START_BLOCK_LAUNCHPAD_TESTNET,
          address: factory({
            address: LAUNCHPAD_TESTNET_ADDRESSES.factory as `0x${string}`,
            event: parseAbiItem('event TokenCreated(address indexed token, address indexed creator, string name, string symbol, address baseAsset, uint256 initialVirtualBaseReserves, address feeRecipient, string metadataURI)'),
            parameter: "token",
          })
        },
        citrea: {
          startBlock: START_BLOCK_LAUNCHPAD_MAINNET,
          address: factory({
            address: LAUNCHPAD_MAINNET_ADDRESSES.factory as `0x${string}`,
            event: parseAbiItem('event TokenCreated(address indexed token, address indexed creator, string name, string symbol, address baseAsset, uint256 initialVirtualBaseReserves, address feeRecipient, string metadataURI)'),
            parameter: "token",
          })
        },
      },
    },
    UniswapV2Pair: {
      abi: UniswapV2PairAbi as any,
      chain: {
        citreaTestnet: {
          startBlock: START_BLOCK_LAUNCHPAD_TESTNET,
          address: factory({
            address: V2_FACTORY_ADDRESSES[ChainId.CITREA_TESTNET] as `0x${string}`,
            event: parseAbiItem('event PairCreated(address indexed token0, address indexed token1, address pair, uint256)'),
            parameter: "pair",
          })
        },
        citrea: {
          startBlock: START_BLOCK_LAUNCHPAD_MAINNET,
          address: factory({
            address: V2_FACTORY_ADDRESSES[ChainId.CITREA_MAINNET] as `0x${string}`,
            event: parseAbiItem('event PairCreated(address indexed token0, address indexed token1, address pair, uint256)'),
            parameter: "pair",
          })
        },
      },
    },
    JuiceSwapGovernor: {
      abi: JuiceSwapGovernorAbi as any,
      chain: {
        citreaTestnet: {
          address: V3_TESTNET_ADDRESSES.juiceSwapGovernorAddress as `0x${string}`,
          startBlock: START_BLOCK_TESTNET,
        },
        citrea: {
          address: V3_MAINNET_ADDRESSES.juiceSwapGovernorAddress as `0x${string}`,
          startBlock: START_BLOCK_MAINNET,
        },
      },
    },
    JuiceSwapFeeCollector: {
      abi: JuiceSwapFeeCollectorAbi as any,
      chain: {
        citreaTestnet: {
          address: V3_TESTNET_ADDRESSES.juiceSwapFeeCollectorAddress as `0x${string}`,
          startBlock: START_BLOCK_TESTNET,
        },
        citrea: {
          address: V3_MAINNET_ADDRESSES.juiceSwapFeeCollectorAddress as `0x${string}`,
          startBlock: START_BLOCK_MAINNET,
        },
      },
    },
    JuiceSwapGateway: {
      abi: JuiceSwapGatewayAbi as any,
      chain: {
        citreaTestnet: {
          address: V3_TESTNET_ADDRESSES.juiceSwapGatewayAddress as `0x${string}`,
          startBlock: START_BLOCK_TESTNET,
        },
        citrea: {
          address: V3_MAINNET_ADDRESSES.juiceSwapGatewayAddress as `0x${string}`,
          startBlock: START_BLOCK_MAINNET,
        },
      },
    },
    LayerZeroOFT: {
      abi: LayerZeroOFTAbi as any,
      chain: {
        citrea: {
          address: [
            V3_MAINNET_ADDRESSES.l0UsdcOftAddress as `0x${string}`,
            V3_MAINNET_ADDRESSES.l0UsdtOftAddress as `0x${string}`,
            V3_MAINNET_ADDRESSES.l0WbtcOftAddress as `0x${string}`,
          ],
          startBlock: START_BLOCK_MAINNET,
        },
      },
    },
  },
  blocks: {
    blockProgress: {
      chain: {
        citreaTestnet: {
          startBlock: "latest",
        },
        citrea: {
          startBlock: START_BLOCK_MAINNET,
        }
      },
      interval: 100,
    }
  },
});