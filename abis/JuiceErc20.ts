/**
 * Minimal ERC20 ABI for the wallet-balance trackers used by the Juice Points
 * indexer (JUICE equity token + svJUSD savings receipt). Only the `Transfer`
 * event is consumed — `decimals` is hardcoded in the daily-credit math so we
 * don't need a `decimals()` call on every event.
 */
export const JuiceErc20Abi = [
  {
    anonymous: false,
    type: 'event',
    name: 'Transfer',
    inputs: [
      { indexed: true, internalType: 'address', name: 'from', type: 'address' },
      { indexed: true, internalType: 'address', name: 'to', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'value', type: 'uint256' },
    ],
  },
] as const;
