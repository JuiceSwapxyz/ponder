/**
 * USD valuation for LP positions in JuiceSwap pools.
 *
 * The threshold the user-facing UI cares about is "did this wallet hold at
 * least $10 of LP in a JuiceSwap-whitelisted pool?". A *full* mark-to-market
 * (concentrated-V3 math + live oracle) is overkill for that yes/no decision,
 * and would require an on-chain BTC/USD oracle we do not currently have.
 *
 * Instead we use a stablecoin-anchored valuation:
 *   - Stable + Stable      pool: USD = stable0 + stable1
 *   - Stable + BTC         pool: USD = 2 × stable_side   (mirrors a balanced LP)
 *   - BTC + BTC            pool: not eligible for points (no oracle)
 *   - Neither stable nor BTC:    not eligible for points
 *
 * Amounts are normalized from token-native decimals into a "USD-cent integer"
 * scale (USD × 100, integer math, no floats) so the on-chain BigInts never
 * lose precision when summed across many events.
 */
import { getPointsConfig } from "./pointsWhitelist";

/** USD threshold (cents) below which a wallet earns no LP credit. */
export const MIN_LIQUIDITY_USD_CENTS = 1000n; // = $10.00

/** Returned by `valueLpDeltaCents` when the pool/tokens are not LP-eligible. */
const NOT_ELIGIBLE = null;

interface ValuationInput {
  chainId: number;
  token0Address: string;
  token1Address: string;
  token0Decimals: number;
  token1Decimals: number;
  /** Signed amount of token0 the wallet added (positive) or removed (negative). */
  amount0: bigint;
  /** Signed amount of token1 the wallet added (positive) or removed (negative). */
  amount1: bigint;
}

/**
 * Convert a raw token amount into "USD cents × 10^4" for stable tokens.
 * The extra 10^4 multiplier keeps small stable amounts from rounding to zero;
 * callers reduce back to cents at the end.
 *
 * For a stable token with `d` decimals, 1 unit of token == 10^d raw units == $1.
 *   centsScaled = rawAmount × 10^4 × 100 / 10^d
 *               = rawAmount × 10^(6 - d)
 * To stay in BigInt: if (6 - d) >= 0, multiply; else divide.
 */
function stableRawToCentsScaled(raw: bigint, decimals: number): bigint {
  const exp = 6 - decimals;
  if (exp >= 0) {
    return raw * 10n ** BigInt(exp);
  }
  return raw / 10n ** BigInt(-exp);
}

const CENTS_SCALE = 10_000n; // matches the 10^4 multiplier in stableRawToCentsScaled

/**
 * Returns the signed USD-cent change to a wallet's LP position implied by
 * `amount0/amount1`, or `NOT_ELIGIBLE` if the pool is not whitelisted.
 *
 * Positive return = position increased in USD value; negative = decreased.
 * Caller is responsible for adding/subtracting against a running balance.
 */
export function valueLpDeltaCents(input: ValuationInput): bigint | null {
  const cfg = getPointsConfig(input.chainId);
  const t0 = input.token0Address.toLowerCase();
  const t1 = input.token1Address.toLowerCase();

  const t0Stable = cfg.usdTokens.has(t0);
  const t1Stable = cfg.usdTokens.has(t1);
  const t0Btc = cfg.btcTokens.has(t0);
  const t1Btc = cfg.btcTokens.has(t1);

  // Stable + Stable: USD = stable0 + stable1
  if (t0Stable && t1Stable) {
    const s0 = stableRawToCentsScaled(input.amount0, input.token0Decimals);
    const s1 = stableRawToCentsScaled(input.amount1, input.token1Decimals);
    return (s0 + s1) / CENTS_SCALE;
  }

  // Stable + BTC: USD ≈ 2 × stable_side (balanced LP assumption)
  if (t0Stable && t1Btc) {
    const s0 = stableRawToCentsScaled(input.amount0, input.token0Decimals);
    return (2n * s0) / CENTS_SCALE;
  }
  if (t1Stable && t0Btc) {
    const s1 = stableRawToCentsScaled(input.amount1, input.token1Decimals);
    return (2n * s1) / CENTS_SCALE;
  }

  // BTC+BTC or non-whitelisted: skip.
  return NOT_ELIGIBLE;
}
