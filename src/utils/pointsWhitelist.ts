/**
 * Per-chain allowlists driving the Juice Points system.
 *
 *   ROUTER_ALLOWLIST  — `event.transaction.to` MUST be in this set for a Swap
 *                       event to count as a JuiceSwap swap (and write a
 *                       `transactionSwap` row). This blocks direct-pool arb,
 *                       foreign aggregators (1inch, etc.) and bot contracts.
 *
 *   USD_TOKENS        — Tokens treated as $1 for LP USD valuation
 *                       (JUSD, l0Usdc, l0Usdt).
 *
 *   BTC_TOKENS        — BTC-pegged tokens (WcBTC, l0Wbtc). Their USD value is
 *                       derived from the mirrored stable side of a balanced
 *                       LP position, so no on-chain BTC/USD oracle is needed
 *                       for the points threshold check.
 *
 * Addresses come from `@juiceswapxyz/sdk-core` (CHAIN_TO_ADDRESSES_MAP +
 * dedicated stablecoin/BTC token constants in the local deployments).
 * They are stored lowercase here so callers can do a constant-time `Set.has`
 * after a single `.toLowerCase()` on the incoming address.
 */
import { ChainId } from "@juiceswapxyz/sdk-core";

const lower = (s: string): string => s.toLowerCase();

// ---------- Citrea Mainnet (4114) ----------

const MAINNET_SWAP_ROUTER_02 = "0x565eD3D57fe40f78A46f348C220121AE093c3cF8";
const MAINNET_GATEWAY = "0xAFcfD58Fe17BEb0c9D15C51D19519682dFcdaab9";
const MAINNET_LAUNCHPAD_ROUTER = "0x6BDea31C89E0A202cE84b5752BB2e827B39984ae";
const MAINNET_POSITION_MANAGER = "0x3D3821D358f56395d4053954f98aec0E1F0fa568";

const MAINNET_JUSD = "0x0987D3720D38847ac6dBB9D025B9dE892a3CA35C";
const MAINNET_L0_USDC = "0xE045e6c36cF77FAA2CfB54466D71A3aEF7bbE839";
const MAINNET_L0_USDT = "0x9f3096Bac87e7F03DC09b0B416eB0DF837304dc4";
const MAINNET_WCBTC = "0x3100000000000000000000000000000000000006";
const MAINNET_L0_WBTC = "0xDF240DC08B0FdaD1d93b74d5048871232f6BEA3d";

// ---------- Citrea Testnet (5115) ----------

const TESTNET_SWAP_ROUTER_02 = "0x26C106BC45E0dd599cbDD871605497B2Fc87c185";
const TESTNET_GATEWAY = "0x8eE3Dd585752805A258ad3a963949a7c3fec44eB";
const TESTNET_LAUNCHPAD_ROUTER = "0x37164703eF51EcB49C9a565C233a277003aE483f";
const TESTNET_POSITION_MANAGER = "0x86e7A161cb9696E6d438c0c77dd18244efa2B8b1";

const TESTNET_JUSD = "0x6a850a548fdd050e8961223ec8FfCDfacEa57E39";
const TESTNET_WCBTC = "0x8d0c9d1c17aE5e40ffF9bE350f57840E9E66Cd93";

// ---------- Per-chain sets ----------

interface PointsConfig {
  /**
   * `event.transaction.to` must be in this set to count as a JuiceSwap swap.
   * Includes SwapRouter02, Gateway and the launchpad router. The NFT position
   * manager is intentionally excluded — it issues LP changes, not swaps.
   */
  routerAllowlist: ReadonlySet<string>;
  /** Tokens treated as $1 for LP USD valuation. */
  usdTokens: ReadonlySet<string>;
  /** BTC-pegged tokens (no fixed USD value — mirrored from stable side). */
  btcTokens: ReadonlySet<string>;
}

const MAINNET: PointsConfig = {
  routerAllowlist: new Set([
    lower(MAINNET_SWAP_ROUTER_02),
    lower(MAINNET_GATEWAY),
    lower(MAINNET_LAUNCHPAD_ROUTER),
  ]),
  usdTokens: new Set([
    lower(MAINNET_JUSD),
    lower(MAINNET_L0_USDC),
    lower(MAINNET_L0_USDT),
  ]),
  btcTokens: new Set([lower(MAINNET_WCBTC), lower(MAINNET_L0_WBTC)]),
};

const TESTNET: PointsConfig = {
  routerAllowlist: new Set([
    lower(TESTNET_SWAP_ROUTER_02),
    lower(TESTNET_GATEWAY),
    lower(TESTNET_LAUNCHPAD_ROUTER),
  ]),
  usdTokens: new Set([lower(TESTNET_JUSD)]),
  btcTokens: new Set([lower(TESTNET_WCBTC)]),
};

const EMPTY: PointsConfig = {
  routerAllowlist: new Set(),
  usdTokens: new Set(),
  btcTokens: new Set(),
};

export function getPointsConfig(chainId: number): PointsConfig {
  if (chainId === ChainId.CITREA_MAINNET) return MAINNET;
  if (chainId === ChainId.CITREA_TESTNET) return TESTNET;
  return EMPTY;
}

/**
 * True iff `routerAddress` is a JuiceSwap router/gateway for `chainId`.
 * Accepts already-lowercased or checksum input. Returns `false` for empty/null
 * input — callers should treat that as "not a JuiceSwap swap".
 */
export function isJuiceSwapRouter(
  chainId: number,
  routerAddress: string | null | undefined,
): boolean {
  if (!routerAddress) return false;
  return getPointsConfig(chainId).routerAllowlist.has(routerAddress.toLowerCase());
}

/** Position-manager addresses (used by the LP points handler to scope events). */
export function getPositionManagerAddress(chainId: number): string | undefined {
  if (chainId === ChainId.CITREA_MAINNET) return MAINNET_POSITION_MANAGER;
  if (chainId === ChainId.CITREA_TESTNET) return TESTNET_POSITION_MANAGER;
  return undefined;
}
