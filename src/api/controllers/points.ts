/**
 * Points API controller - endpoints powering the JuiceSwap "Juice Points" UI.
 *
 *   GET /points/:address          -> PointsBreakdown for this wallet
 *   GET /points/leaderboard       -> Top N wallets ranked by TOTAL points
 *                                    (reconciles with each wallet's breakdown)
 *
 * The aggregation logic lives in `pointsCompute.ts` (pure, db-injected) so it
 * can be tested against a real Postgres without the Ponder runtime. This file
 * is the thin HTTP layer: address validation, caching, and the 503/500 mapping.
 *
 * Points categories surfaced in PointsBreakdown:
 *   - swaps      — POINTS_PER_SWAP per JuiceSwap-router-originated swap,
 *                  daily-capped at MAX_SWAP_POINTS_PER_DAY per address.
 *   - liquidity  — POINTS_PER_LIQUIDITY_DAY per UTC day a wallet held ≥ $10
 *                  of LP in whitelisted pools throughout the whole 24h window.
 *   - bonuses    — one-time launchpad bonuses (create / graduate) plus daily
 *                  hold streams (savings / juiceHold / lending). See
 *                  `pointsCompute.ts` for the full anti-exploit documentation.
 */

import { Context, Hono } from "hono";
import { getAddress, isAddress } from "viem";
import NodeCache from "node-cache";
// @ts-ignore
import { db } from "ponder:api";
import {
  buildBreakdown,
  computeLeaderboard,
  FinalityUnknownError,
  latestFinalizedBlock,
  POINTS_CONFIG,
  type LeaderboardEntry,
  type PointsBreakdown,
} from "./pointsCompute";

const POINTS_CACHE_TTL_S = 30;
const LEADERBOARD_CACHE_TTL_S = 30;

interface LeaderboardPayload {
  entries: LeaderboardEntry[];
  updatedAt: number;
}

const pointsCache = new NodeCache({
  stdTTL: POINTS_CACHE_TTL_S,
  checkperiod: 5,
  useClones: false,
});
const leaderboardCache = new NodeCache({
  stdTTL: LEADERBOARD_CACHE_TTL_S,
  checkperiod: 5,
  useClones: false,
});

const points = new Hono();

points.get("/leaderboard", async (c: Context) => {
  const cached = leaderboardCache.get<LeaderboardPayload>("top");
  if (cached) {
    return c.json(cached);
  }

  let finalityCutoff: bigint;
  try {
    finalityCutoff = await latestFinalizedBlock(db);
  } catch (err) {
    if (err instanceof FinalityUnknownError) {
      return c.json({ error: "Indexer not ready" }, 503);
    }
    console.error("blockProgress query error", err);
    return c.json({ error: "Failed to read indexer state" }, 500);
  }

  try {
    const entries = await computeLeaderboard(db, finalityCutoff);
    const payload: LeaderboardPayload = { entries, updatedAt: Date.now() };
    leaderboardCache.set("top", payload);
    return c.json(payload);
  } catch (err) {
    console.error("leaderboard error", err);
    return c.json({ error: "Failed to compute leaderboard" }, 500);
  }
});

points.get("/:address", async (c: Context) => {
  const raw = c.req.param("address");
  if (!raw || !isAddress(raw)) {
    return c.json({ error: "Invalid address" }, 400);
  }
  // Stored in checksum form by the indexer - preserve so the index is used.
  const checksumAddress = getAddress(raw);
  const cacheKey = checksumAddress.toLowerCase();

  const cached = pointsCache.get<PointsBreakdown>(cacheKey);
  if (cached) {
    return c.json(cached);
  }

  let finalityCutoff: bigint;
  try {
    finalityCutoff = await latestFinalizedBlock(db);
  } catch (err) {
    if (err instanceof FinalityUnknownError) {
      return c.json({ error: "Indexer not ready" }, 503);
    }
    console.error("blockProgress query error", err);
    return c.json({ error: "Failed to read indexer state" }, 500);
  }

  try {
    const breakdown = await buildBreakdown(db, checksumAddress, finalityCutoff);
    pointsCache.set(cacheKey, breakdown);
    return c.json(breakdown);
  } catch (err) {
    console.error("points error", err);
    return c.json({ error: "Failed to compute points" }, 500);
  }
});

export default points;

// Re-export configuration for documentation / sanity checks (read-only).
export { POINTS_CONFIG };
