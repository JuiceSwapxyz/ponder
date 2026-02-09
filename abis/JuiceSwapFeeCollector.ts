export const JuiceSwapFeeCollectorAbi = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "FactoryOwnerUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "oldRouter",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "newRouter",
        type: "address",
      },
    ],
    name: "SwapRouterUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "oldCollector",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "newCollector",
        type: "address",
      },
    ],
    name: "CollectorUpdated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint32",
        name: "twapPeriod",
        type: "uint32",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "maxSlippageBps",
        type: "uint256",
      },
    ],
    name: "ProtectionParamsUpdated",
    type: "event",
  },
] as const;
