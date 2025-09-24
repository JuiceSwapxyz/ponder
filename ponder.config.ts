import { createConfig } from "ponder";
import { UniswapV3PoolAbi } from "./abis/UniswapV3Pool";
import { citreaTransport } from "./citrea-transport-fix";

export default createConfig({
  chains: {
    // Citrea Testnet
    citreaTestnet: {
      id: 5115,
      rpc: citreaTransport(process.env.CITREA_RPC_URL ?? "https://rpc.testnet.citrea.xyz"),
    },
  },
  contracts: {
    // CITREA TESTNET - UniswapV3 Pool Contracts for Citrea bApps Campaign
    CBTCNUSDPool_CitreaTestnet: {
      chain: "citreaTestnet",
      address: "0x6006797369E2A595D31Df4ab3691044038AAa7FE",
      abi: UniswapV3PoolAbi,
      filter: {
        event: "Swap",
      },
      startBlock: 15455001,
    },
    CBTCcUSDPool_CitreaTestnet: {
      chain: "citreaTestnet",
      address: "0xA69De906B9A830Deb64edB97B2eb0848139306d2",
      abi: UniswapV3PoolAbi,
      filter: {
        event: "Swap",
      },
      startBlock: 15455001,
    },
    CBTCUSDCPool_CitreaTestnet: {
      chain: "citreaTestnet",
      address: "0xD8C7604176475eB8D350bC1EE452dA4442637C09",
      abi: UniswapV3PoolAbi,
      filter: {
        event: "Swap",
      },
      startBlock: 15455001,
    },
  },
});