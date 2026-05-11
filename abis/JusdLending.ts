/**
 * Minimal ABIs for JUSD lending point tracking.
 *
 *   MintingHubGateway:PositionOpened — emitted when a borrower opens a new
 *     position via the JUSD Minting Hub gateway. Drives the ponder factory
 *     pattern so each newly cloned `Position` contract gets indexed.
 *
 *   Position:MintingUpdate — emitted whenever a position's minted JUSD
 *     principal changes (mint, repay, partial close). The `principal` arg is
 *     the current outstanding JUSD debt for the position, in raw 18-decimal
 *     units; we treat 1 JUSD = $1 for the points-per-$1 math.
 */

export const JusdMintingHubAbi = [
  {
    anonymous: false,
    type: 'event',
    name: 'PositionOpened',
    inputs: [
      { indexed: true, internalType: 'address', name: 'owner', type: 'address' },
      { indexed: true, internalType: 'address', name: 'position', type: 'address' },
      { indexed: false, internalType: 'address', name: 'original', type: 'address' },
      { indexed: false, internalType: 'address', name: 'collateral', type: 'address' },
    ],
  },
] as const;

export const JusdPositionAbi = [
  {
    anonymous: false,
    type: 'event',
    name: 'MintingUpdate',
    inputs: [
      { indexed: false, internalType: 'uint256', name: 'collateral', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'price', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'principal', type: 'uint256' },
    ],
  },
] as const;
