/**
 * TokenFactory ABI - re-exported from @juiceswapxyz/launchpad package
 */
import { TokenFactoryABI } from "@juiceswapxyz/launchpad";

const DevBuyExecutedAbi = [
  {
    type: "event",
    name: "DevBuyExecuted",
    anonymous: false,
    inputs: [
      { indexed: true, name: "token", type: "address" },
      { indexed: true, name: "creator", type: "address" },
      { indexed: false, name: "baseIn", type: "uint256" },
      { indexed: false, name: "tokensOut", type: "uint256" },
    ],
  },
] as const;

export const TokenFactoryAbi = [
  ...TokenFactoryABI,
  ...DevBuyExecutedAbi,
] as const;
