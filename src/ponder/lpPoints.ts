/**
 * Juice Points — LP credit tracker.
 *
 * Listens to V3 NonfungiblePositionManager events to maintain:
 *   - `lpPosition`        per-NFT running USD-cent value
 *   - `lpPositionWallet`  per-wallet aggregate (= sum across all owned NFTs)
 *   - `lpDayCredit`       one row per (wallet, UTC day) where the wallet
 *                         continuously held ≥ MIN_LIQUIDITY_USD_CENTS during
 *                         the entire 24h window
 *
 * Eligibility rule (matches the user spec):
 *
 *   Only V3 pools whose `token0` AND `token1` are both in the points
 *   whitelist count for LP credit. The whitelist is JUSD + l0Usdc + l0Usdt
 *   (USD stables) and WcBTC + l0Wbtc (BTC pegs). BTC/BTC pools have no
 *   reliable USD-cents valuation here and are skipped. Pools with launchpad
 *   meme tokens are skipped — points are explicitly for "real liquidity".
 *
 * Day-credit semantics (so the rule "above $10 counts, below doesn't" is
 * provably correct under chain reorgs and event gaps):
 *
 *   At every LP event we know two things:
 *     (a) the wallet's aggregate USD-cent value JUST BEFORE this event (V_old)
 *         held continuously since `lastEventTimestamp = T_old`
 *     (b) the new aggregate JUST AFTER this event (V_new) at T_new
 *
 *   If V_old ≥ MIN, then for every UTC day D fully covered by
 *   [T_old, T_new] (i.e. day-start(D) ≥ T_old AND day-end(D) ≤ T_new) we
 *   write one `lpDayCredit` row. This is the "completed days where wallet
 *   held ≥ $10 the whole day" set.
 *
 *   Days where the wallet's value dipped below MIN during the day are NOT
 *   credited, because the dip event closes the window before the day ends.
 *
 *   At READ time, `points.ts` adds the live tail: days completed since the
 *   last event where V_current ≥ MIN. That way an inactive wallet still
 *   accrues credit between events.
 *
 * Anti-exploit: positions are valued from the principal `amount0/amount1`
 * deposited (NOT from market price), so flash-loaning $10 of LP in and out
 * within one second triggers NO day credit (the in-and-out happens in the
 * same UTC day; no fully-covered day is added).
 */
import { lpDayCredit, lpPosition, lpPositionWallet, pool, position, token } from "ponder.schema";
// @ts-ignore
import { ponder } from "ponder:registry";
import { getAddress, zeroAddress } from "viem";
// @ts-ignore
import { MIN_LIQUIDITY_USD_CENTS, valueLpDeltaCents } from "@/utils/lpValuation";

const SECONDS_PER_DAY = 86_400n;

/**
 * Hard cap on day-credit rows written by a single event. Stops one stale-NFT
 * sweep from inserting thousands of rows if a wallet has been inactive for
 * years. 365 = one year. Anything longer just doesn't accrue credit beyond
 * the cap — the next event picks up where this left off (idempotent on insert).
 */
const MAX_DAY_CREDITS_PER_EVENT = 365;

/**
 * Returns the (D_min, D_max) closed interval of UTC days fully covered by
 * the half-open time window [tOld, tNew). A day D is "fully covered" iff
 *   day-start(D)        >= tOld    (the day began after tOld)
 *   day-end(D) = D+1    <= tNew    (the day ended before tNew)
 * Returns null if no day is fully covered (most events).
 */
function fullyCoveredDays(tOld: bigint, tNew: bigint): { dMin: bigint; dMax: bigint } | null {
  if (tNew <= tOld) return null;
  // D >= ceil(tOld / SECONDS_PER_DAY)
  const dMin = (tOld + SECONDS_PER_DAY - 1n) / SECONDS_PER_DAY;
  // D+1 <= tNew / SECONDS_PER_DAY  -> D <= floor(tNew / SECONDS_PER_DAY) - 1
  const dMax = tNew / SECONDS_PER_DAY - 1n;
  if (dMax < dMin) return null;
  return { dMin, dMax };
}

async function loadPoolMeta(context: any, poolAddress: string): Promise<
  | {
      token0Address: string;
      token1Address: string;
      token0Decimals: number;
      token1Decimals: number;
    }
  | null
> {
  const p = await context.db.find(pool, { id: getAddress(poolAddress) });
  if (!p) return null;
  const t0 = await context.db.find(token, { id: String(p.token0).toLowerCase() });
  const t1 = await context.db.find(token, { id: String(p.token1).toLowerCase() });
  if (!t0 || !t1) return null;
  return {
    token0Address: p.token0,
    token1Address: p.token1,
    token0Decimals: Number(t0.decimals),
    token1Decimals: Number(t1.decimals),
  };
}

/**
 * Write fully-covered-day credit rows AND update the wallet aggregate. Both
 * are done together so the running balance & "lastEventTimestamp" are always
 * consistent with the rows on disk.
 */
async function applyEventToWallet(
  context: any,
  chainId: number,
  walletChecksum: string,
  deltaCents: bigint,
  blockTimestamp: bigint,
): Promise<void> {
  const walletKey = walletChecksum.toLowerCase();
  const id = `${chainId}:${walletKey}`;
  const existing = await context.db.find(lpPositionWallet, { id });

  const oldValue = existing?.usdCents ?? 0n;
  // Clamp at 0 — small accounting drift (rounding/withdraw-rounding) must not
  // push the running balance negative.
  const newValue = oldValue + deltaCents > 0n ? oldValue + deltaCents : 0n;
  const oldTimestamp = existing?.lastEventTimestamp ?? blockTimestamp;

  if (oldValue >= MIN_LIQUIDITY_USD_CENTS) {
    const span = fullyCoveredDays(oldTimestamp, blockTimestamp);
    if (span) {
      const total = Number(span.dMax - span.dMin) + 1;
      const cap = Math.min(total, MAX_DAY_CREDITS_PER_EVENT);
      for (let i = 0; i < cap; i++) {
        const day = span.dMin + BigInt(i);
        await context.db
          .insert(lpDayCredit)
          .values({
            id: `${chainId}:${walletKey}:${day}`,
            chainId,
            walletAddress: walletChecksum,
            day,
          })
          .onConflictDoNothing();
      }
    }
  }

  if (existing) {
    await context.db
      .update(lpPositionWallet, { id })
      .set({ usdCents: newValue, lastEventTimestamp: blockTimestamp });
  } else {
    await context.db
      .insert(lpPositionWallet)
      .values({
        id,
        chainId,
        walletAddress: walletChecksum,
        usdCents: newValue,
        lastEventTimestamp: blockTimestamp,
      })
      .onConflictDoNothing();
  }
}

ponder.on(
  "NonfungiblePositionManager:IncreaseLiquidity",
  async ({ event, context }: { event: any; context: any }) => {
    try {
      const chainId = context.chain.id;
      const tokenId = String(event.args.tokenId);
      const posId = `${chainId}-${tokenId}`;

      const pos = await context.db.find(position, { id: posId });
      if (!pos) return; // position handler hasn't seen the Mint Transfer yet
      const meta = await loadPoolMeta(context, pos.poolAddress);
      if (!meta) return;

      const delta = valueLpDeltaCents({
        chainId,
        token0Address: meta.token0Address,
        token1Address: meta.token1Address,
        token0Decimals: meta.token0Decimals,
        token1Decimals: meta.token1Decimals,
        amount0: event.args.amount0 as bigint,
        amount1: event.args.amount1 as bigint,
      });
      if (delta === null || delta <= 0n) return;

      // Per-NFT running value
      const lpId = `${chainId}:${tokenId}`;
      const existing = await context.db.find(lpPosition, { id: lpId });
      const newValue = (existing?.usdCents ?? 0n) + delta;
      if (existing) {
        await context.db
          .update(lpPosition, { id: lpId })
          .set({ usdCents: newValue });
      } else {
        await context.db
          .insert(lpPosition)
          .values({
            id: lpId,
            chainId,
            tokenId,
            owner: getAddress(pos.owner),
            poolAddress: getAddress(pos.poolAddress),
            usdCents: newValue,
          })
          .onConflictDoNothing();
      }

      // Wallet aggregate + day credit
      await applyEventToWallet(context, chainId, getAddress(pos.owner), delta, event.block.timestamp);
    } catch (err) {
      console.error("[lpPoints] IncreaseLiquidity error:", err);
    }
  },
);

ponder.on(
  "NonfungiblePositionManager:DecreaseLiquidity",
  async ({ event, context }: { event: any; context: any }) => {
    try {
      const chainId = context.chain.id;
      const tokenId = String(event.args.tokenId);
      const lpId = `${chainId}:${tokenId}`;
      const lp = await context.db.find(lpPosition, { id: lpId });
      if (!lp) return; // never tracked → not whitelisted, nothing to subtract

      const meta = await loadPoolMeta(context, lp.poolAddress);
      if (!meta) return;

      const removed = valueLpDeltaCents({
        chainId,
        token0Address: meta.token0Address,
        token1Address: meta.token1Address,
        token0Decimals: meta.token0Decimals,
        token1Decimals: meta.token1Decimals,
        amount0: event.args.amount0 as bigint,
        amount1: event.args.amount1 as bigint,
      });
      if (removed === null || removed <= 0n) return;

      // Cap at the position's current value — withdrawals can never push the
      // principal-anchored valuation below zero.
      const capped = removed > lp.usdCents ? lp.usdCents : removed;
      await context.db
        .update(lpPosition, { id: lpId })
        .set({ usdCents: lp.usdCents - capped });

      await applyEventToWallet(
        context,
        chainId,
        getAddress(lp.owner),
        0n - capped,
        event.block.timestamp,
      );
    } catch (err) {
      console.error("[lpPoints] DecreaseLiquidity error:", err);
    }
  },
);

/**
 * Hook called from the existing NonfungiblePositionManager:Transfer handler
 * (positions.ts) so we don't register two handlers for the same event.
 * Moves the LP position's USD value between wallets and credits any
 * fully-covered UTC days on the sender side.
 */
export async function handleLpTransfer(
  event: any,
  context: any,
): Promise<void> {
  try {
    const chainId = context.chain.id;
    const tokenId = String(event.args.tokenId);
    const lpId = `${chainId}:${tokenId}`;
    const lp = await context.db.find(lpPosition, { id: lpId });
    if (!lp || lp.usdCents === 0n) return;

    const from = String(event.args.from);
    const to = String(event.args.to);

    // Mint (from == 0x0): IncreaseLiquidity in the same tx wires the value in.
    if (from === zeroAddress) return;

    const currentValue = BigInt(lp.usdCents);

    // Burn (to == 0x0): debit the existing owner, zero out the position.
    if (to === zeroAddress) {
      await applyEventToWallet(
        context,
        chainId,
        getAddress(lp.owner),
        0n - currentValue,
        event.block.timestamp,
      );
      await context.db
        .update(lpPosition, { id: lpId })
        .set({ owner: zeroAddress, usdCents: 0n });
      return;
    }

    // Standard transfer: move value between wallets.
    await applyEventToWallet(context, chainId, getAddress(from), 0n - currentValue, event.block.timestamp);
    await applyEventToWallet(context, chainId, getAddress(to), currentValue, event.block.timestamp);
    await context.db.update(lpPosition, { id: lpId }).set({ owner: getAddress(to) });
  } catch (err) {
    console.error("[lpPoints] Transfer hook error:", err);
  }
}
