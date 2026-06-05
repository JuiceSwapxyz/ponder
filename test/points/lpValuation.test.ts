import { describe, expect, it } from "vitest";
import { valueLpDeltaCents } from "../../src/utils/lpValuation";

const CHAIN = 4114;

const MAINNET_JUSD = "0x0987D3720D38847ac6dBB9D025B9dE892a3CA35C";
const MAINNET_L0_USDC = "0xE045e6c36cF77FAA2CfB54466D71A3aEF7bbE839";
const MAINNET_L0_USDT = "0x9f3096Bac87e7F03DC09b0B416eB0DF837304dc4";
const MAINNET_WCBTC = "0x3100000000000000000000000000000000000006";
const MAINNET_L0_WBTC = "0xDF240DC08B0FdaD1d93b74d5048871232f6BEA3d";
const UNKNOWN_TOKEN = "0x9999999999999999999999999999999999999999";

describe("valueLpDeltaCents", () => {
  it("converts stable-stable raw LP deltas into exact signed USD cents", () => {
    const cents = valueLpDeltaCents({
      chainId: CHAIN,
      token0Address: MAINNET_JUSD,
      token1Address: MAINNET_L0_USDC,
      token0Decimals: 18,
      token1Decimals: 6,
      amount0: 12_340_000_000_000_000_000n,
      amount1: 5_670_000n,
    });

    expect(cents).toBe(1_801n);
  });

  it("values stable-BTC LP deltas as twice the stable side", () => {
    const cents = valueLpDeltaCents({
      chainId: CHAIN,
      token0Address: MAINNET_L0_USDT,
      token1Address: MAINNET_WCBTC,
      token0Decimals: 6,
      token1Decimals: 8,
      amount0: 25_000_000n,
      amount1: 50_000_000n,
    });

    expect(cents).toBe(5_000n);
  });

  it("keeps removal deltas negative after stable-token decimal scaling", () => {
    const cents = valueLpDeltaCents({
      chainId: CHAIN,
      token0Address: MAINNET_JUSD,
      token1Address: MAINNET_L0_USDC,
      token0Decimals: 18,
      token1Decimals: 6,
      amount0: -3_250_000_000_000_000_000n,
      amount1: -1_250_000n,
    });

    expect(cents).toBe(-450n);
  });

  it("returns null for BTC-BTC and non-whitelisted pools", () => {
    expect(
      valueLpDeltaCents({
        chainId: CHAIN,
        token0Address: MAINNET_WCBTC,
        token1Address: MAINNET_L0_WBTC,
        token0Decimals: 8,
        token1Decimals: 8,
        amount0: 100_000_000n,
        amount1: 100_000_000n,
      }),
    ).toBeNull();

    expect(
      valueLpDeltaCents({
        chainId: CHAIN,
        token0Address: MAINNET_JUSD,
        token1Address: UNKNOWN_TOKEN,
        token0Decimals: 18,
        token1Decimals: 18,
        amount0: 10_000_000_000_000_000_000n,
        amount1: 10_000_000_000_000_000_000n,
      }),
    ).toBeNull();
  });
});
