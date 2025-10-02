import { createConfig, rateLimit } from "ponder";
import { UniswapV3PoolAbi } from "./abis/UniswapV3Pool";
import { citreaTransport } from "./citrea-transport-fix";
import { NonfungiblePositionManagerAbi } from "./abis/NonfungiblePositionManager";
import { UniswapV3FactoryAbi } from "./abis/UniswapV3Factory";

const getDefaultRpcUrl = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  return isProduction
    ? "http://vm-dfx-node-prd.westeurope.cloudapp.azure.com:8085"
    : "http://vm-dfx-node-dev.westeurope.cloudapp.azure.com:8085";
};

export default createConfig({
  chains: {
    // Citrea Testnet
    citreaTestnet: {
      id: 5115,
      rpc: rateLimit(citreaTransport(process.env.CITREA_RPC_URL ?? getDefaultRpcUrl()), {
        requestsPerSecond: 30
      }),
    },
  },
  contracts: {
    // CITREA TESTNET - UniswapV3 Pool Contracts for Citrea bApps Campaign
    CBTCNUSDPool_CitreaTestnet: {
      chain: "citreaTestnet",
      address: "0x6006797369E2A595D31Df4ab3691044038AAa7FE",
      abi: UniswapV3PoolAbi as any,
      filter: {
        event: "Swap",
        args: {},
      } as any,
      startBlock: 15455001,
    },
    CBTCcUSDPool_CitreaTestnet: {
      chain: "citreaTestnet",
      address: "0xA69De906B9A830Deb64edB97B2eb0848139306d2",
      abi: UniswapV3PoolAbi as any,
      filter: {
        event: "Swap",
        args: {},
      } as any,
      startBlock: 15455001,
    },
    CBTCUSDCPool_CitreaTestnet: {
      chain: "citreaTestnet",
      address: "0xD8C7604176475eB8D350bC1EE452dA4442637C09",
      abi: UniswapV3PoolAbi as any,
      filter: {
        event: "Swap",
        args: {},
      } as any,
      startBlock: 15455001,
    },
    NonfungiblePositionManager: {
      chain: "citreaTestnet",
      address: "0xe46616BED47317653EE3B7794fC171F4444Ee1c5",
      abi: NonfungiblePositionManagerAbi as any,
      startBlock: 15455001,
    },
    UniswapV3Factory: {
      chain: "citreaTestnet",
      address: "0x6832283eEA5a9A3C4384A5D9a06Db0ce6FE9C79E",
      abi: UniswapV3FactoryAbi as any,
      startBlock: 15455001,
    }
  },
});