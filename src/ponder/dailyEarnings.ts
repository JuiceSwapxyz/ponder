/**
 * Juice Points — daily-running balance handlers.
 *
 * Three earning streams, all driven by the same "credit each fully-covered
 * UTC day at the wallet's MIN balance during that day" rule used by the LP
 * points tracker (`lpPoints.ts`). The rule is anti-exploit: a single moment
 * below the threshold within a day breaks the streak for that day, so flash-
 * loaning balance in for a few blocks and then yanking it back out earns
 * zero credit.
 *
 *   JuiceEquity:Transfer       — Hold X JUICE  → X/10 JP per UTC day
 *   SavingsVaultJUSD:Transfer  — Hold X svJUSD → X     JP per UTC day
 *   MintingHubGateway + Position:MintingUpdate
 *                              — Lend X JUSD   → X*5   JP per UTC day
 *
 * The token holdings handlers share most of the bookkeeping (raw 18-decimal
 * balance, day-credit row writes), parameterised by which schema tables to
 * update. The lending side is similar but aggregated across one or more
 * Position contracts per borrower.
 */
import {
  juiceHoldDayCredit,
  juiceHoldWallet,
  lendingDayCredit,
  lendingPosition,
  lendingWallet,
  savingsDayCredit,
  savingsWallet,
} from "ponder.schema";
// @ts-ignore
import { ponder } from "ponder:registry";
import { getAddress, zeroAddress } from "viem";

const SECONDS_PER_DAY = 86_400n;
/** 1 whole token in 18-decimal raw units (JUICE / svJUSD / JUSD all share this scale). */
const ONE_TOKEN_18 = 10n ** 18n;

/**
 * Hard cap on day-credit rows written by a single event. Same safety net as
 * the LP tracker — a years-dormant wallet shouldn't spam a single tx with
 * thousands of inserts.
 */
const MAX_DAY_CREDITS_PER_EVENT = 365;

/**
 * Floor(rawBalance / 10^18). 1 unit = 1 whole token.
 */
function wholeTokens(raw: bigint): bigint {
  return raw / ONE_TOKEN_18;
}

interface DayCreditTable {
  insert: (ctx: any, row: { id: string; chainId: number; walletAddress: string; day: bigint; minUnits: bigint }) => Promise<void>;
}

/**
 * Generic per-wallet balance update + day-credit rollup for an ERC20-style
 * holding (JUICE or svJUSD). Caller supplies the wallet table, the day
 * credit table, and the column key for the per-day "minUnits" field.
 */
async function applyHoldingEvent(opts: {
  context: any;
  chainId: number;
  wallet: string;          // checksum
  delta: bigint;           // signed raw token delta (positive = inflow)
  timestamp: bigint;
  walletTable: any;
  dayTable: any;
  /** Field name on the day-credit row where the min-whole-tokens value goes. */
  minUnitsColumn: "minJuiceUnits" | "minJusdUnits";
}): Promise<void> {
  const { context, chainId, wallet, delta, timestamp, walletTable, dayTable, minUnitsColumn } = opts;
  if (wallet === zeroAddress) return;
  const walletKey = wallet.toLowerCase();
  const id = `${chainId}:${walletKey}`;
  const existing = await context.db.find(walletTable, { id });

  const oldBalance = existing?.balance ?? 0n;
  // Clamp at 0 — a Transfer logging more out than the wallet holds is
  // impossible on-chain, but defensive clamping survives reorg replays.
  const newBalance = oldBalance + delta > 0n ? oldBalance + delta : 0n;
  const oldTimestamp = existing?.lastEventTimestamp ?? timestamp;

  // Credit every fully-covered UTC day between the previous event and now,
  // at the MIN balance the wallet held throughout that day (= oldBalance,
  // because no event fired in that interval).
  const oldWhole = wholeTokens(oldBalance);
  if (oldWhole > 0n && timestamp > oldTimestamp) {
    const dMin = (oldTimestamp + SECONDS_PER_DAY - 1n) / SECONDS_PER_DAY;
    const dMax = timestamp / SECONDS_PER_DAY - 1n;
    if (dMax >= dMin) {
      const total = Number(dMax - dMin) + 1;
      const cap = Math.min(total, MAX_DAY_CREDITS_PER_EVENT);
      for (let i = 0; i < cap; i++) {
        const day = dMin + BigInt(i);
        await context.db
          .insert(dayTable)
          .values({
            id: `${chainId}:${walletKey}:${day}`,
            chainId,
            walletAddress: wallet,
            day,
            [minUnitsColumn]: oldWhole,
          })
          .onConflictDoNothing();
      }
    }
  }

  if (existing) {
    await context.db.update(walletTable, { id }).set({ balance: newBalance, lastEventTimestamp: timestamp });
  } else {
    await context.db
      .insert(walletTable)
      .values({ id, chainId, walletAddress: wallet, balance: newBalance, lastEventTimestamp: timestamp })
      .onConflictDoNothing();
  }
}

// ---------- JUICE token (equity) — Hold X JUICE → X/10 JP per UTC day ----------

ponder.on("JuiceEquity:Transfer", async ({ event, context }: { event: any; context: any }) => {
  try {
    const chainId = context.chain.id;
    const timestamp = event.block.timestamp as bigint;
    const value = event.args.value as bigint;
    if (value === 0n) return;
    // Debit sender (unless mint).
    if (event.args.from !== zeroAddress) {
      await applyHoldingEvent({
        context,
        chainId,
        wallet: getAddress(event.args.from),
        delta: 0n - value,
        timestamp,
        walletTable: juiceHoldWallet,
        dayTable: juiceHoldDayCredit,
        minUnitsColumn: "minJuiceUnits",
      });
    }
    // Credit recipient (unless burn).
    if (event.args.to !== zeroAddress) {
      await applyHoldingEvent({
        context,
        chainId,
        wallet: getAddress(event.args.to),
        delta: value,
        timestamp,
        walletTable: juiceHoldWallet,
        dayTable: juiceHoldDayCredit,
        minUnitsColumn: "minJuiceUnits",
      });
    }
  } catch (err) {
    console.error("[dailyEarnings] JuiceEquity Transfer error:", err);
  }
});

// ---------- svJUSD (savings) — Hold X svJUSD → X JP per UTC day ----------

ponder.on("SavingsVaultJUSD:Transfer", async ({ event, context }: { event: any; context: any }) => {
  try {
    const chainId = context.chain.id;
    const timestamp = event.block.timestamp as bigint;
    const value = event.args.value as bigint;
    if (value === 0n) return;
    if (event.args.from !== zeroAddress) {
      await applyHoldingEvent({
        context,
        chainId,
        wallet: getAddress(event.args.from),
        delta: 0n - value,
        timestamp,
        walletTable: savingsWallet,
        dayTable: savingsDayCredit,
        minUnitsColumn: "minJusdUnits",
      });
    }
    if (event.args.to !== zeroAddress) {
      await applyHoldingEvent({
        context,
        chainId,
        wallet: getAddress(event.args.to),
        delta: value,
        timestamp,
        walletTable: savingsWallet,
        dayTable: savingsDayCredit,
        minUnitsColumn: "minJusdUnits",
      });
    }
  } catch (err) {
    console.error("[dailyEarnings] svJUSD Transfer error:", err);
  }
});

// ---------- JUSD lending — Mint X JUSD on a Position → X*5 JP per UTC day ----------

// 1) MintingHubGateway:PositionOpened — record (position → owner) mapping.
ponder.on(
  "MintingHubGateway:PositionOpened",
  async ({ event, context }: { event: any; context: any }) => {
    try {
      const chainId = context.chain.id;
      const positionAddress = String(event.args.position);
      const owner = getAddress(event.args.owner);
      await context.db
        .insert(lendingPosition)
        .values({
          id: `${chainId}:${positionAddress.toLowerCase()}`,
          chainId,
          positionAddress: getAddress(positionAddress),
          owner,
          principalJusd: 0n,
        })
        .onConflictDoNothing();
    } catch (err) {
      console.error("[dailyEarnings] PositionOpened error:", err);
    }
  },
);

// 2) Position:MintingUpdate — adjust the borrower's aggregate debt and credit
//    fully-covered days at the previous aggregate.
ponder.on("JusdPosition:MintingUpdate", async ({ event, context }: { event: any; context: any }) => {
  try {
    const chainId = context.chain.id;
    const positionAddress = String(event.log.address);
    const positionKey = positionAddress.toLowerCase();
    const principal = event.args.principal as bigint;

    const lp = await context.db.find(lendingPosition, { id: `${chainId}:${positionKey}` });
    if (!lp) {
      // PositionOpened hasn't materialised yet (out-of-order events on dev
      // sync). Skip — the next MintingUpdate after the open will re-baseline.
      return;
    }

    const oldPrincipal = lp.principalJusd as bigint;
    const delta = principal - oldPrincipal;
    if (delta === 0n) return;

    // Update per-position state.
    await context.db
      .update(lendingPosition, { id: `${chainId}:${positionKey}` })
      .set({ principalJusd: principal });

    // Roll the delta into the borrower's aggregate.
    const owner = getAddress(lp.owner);
    const walletKey = owner.toLowerCase();
    const walletId = `${chainId}:${walletKey}`;
    const wallet = await context.db.find(lendingWallet, { id: walletId });

    const oldTotal = wallet?.totalPrincipalJusd ?? 0n;
    const newTotal = oldTotal + delta > 0n ? oldTotal + delta : 0n;
    const timestamp = event.block.timestamp as bigint;
    const oldTimestamp = wallet?.lastEventTimestamp ?? timestamp;

    // Credit fully-covered days at the MIN whole-JUSD principal held throughout
    // (= oldTotal because no event fired in that interval).
    const oldWhole = wholeTokens(oldTotal);
    if (oldWhole > 0n && timestamp > oldTimestamp) {
      const dMin = (oldTimestamp + SECONDS_PER_DAY - 1n) / SECONDS_PER_DAY;
      const dMax = timestamp / SECONDS_PER_DAY - 1n;
      if (dMax >= dMin) {
        const total = Number(dMax - dMin) + 1;
        const cap = Math.min(total, MAX_DAY_CREDITS_PER_EVENT);
        for (let i = 0; i < cap; i++) {
          const day = dMin + BigInt(i);
          await context.db
            .insert(lendingDayCredit)
            .values({
              id: `${chainId}:${walletKey}:${day}`,
              chainId,
              walletAddress: owner,
              day,
              minJusdUnits: oldWhole,
            })
            .onConflictDoNothing();
        }
      }
    }

    if (wallet) {
      await context.db
        .update(lendingWallet, { id: walletId })
        .set({ totalPrincipalJusd: newTotal, lastEventTimestamp: timestamp });
    } else {
      await context.db
        .insert(lendingWallet)
        .values({
          id: walletId,
          chainId,
          walletAddress: owner,
          totalPrincipalJusd: newTotal,
          lastEventTimestamp: timestamp,
        })
        .onConflictDoNothing();
    }
  } catch (err) {
    console.error("[dailyEarnings] MintingUpdate error:", err);
  }
});
