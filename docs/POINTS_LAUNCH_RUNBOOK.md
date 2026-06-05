# Juice Points — Launch Runbook

End-to-end sequence to take the Juice Points program live across the four
repos. Deploy order is always **ponder → api → bapp**; the contract is deployed
out-of-band before the api flip.

## 0. Pre-flight gates (all must be green)

| Repo | Artifact | Gate |
|------|----------|------|
| ponder | PR #139 `feat/points-correctness` | reviewed, CI green, **total-points leaderboard** test passes |
| api | `feat/juicer-campaign-backend` | `npx tsc --noEmit` + `npx jest` green; migration applied |
| smart-contracts | PR #56 + `scripts/deployJuicerNFT.ts` | 48 contract tests pass; deploy script dry-run OK |
| bapp | #741 Juicer page, #740 rebased | builds; flag-gated |

## 1. Deploy the JuicerNFT contract (out-of-band)

1. Generate a dedicated signer keypair. **Its address is the single source of
   truth** — it goes into the contract as `signer` and into the api as
   `JUICER_SIGNER_PRIVATE_KEY`. A mismatch makes every `claim()` revert with
   `InvalidSignature` (only discoverable on-chain).
2. Decide product params: `JUICER_MAX_SUPPLY`, `JUICER_BASE_TOKEN_URI` (pin
   metadata to IPFS first), `JUICER_CAMPAIGN_START/END`.
3. **Testnet first** (Citrea 5115), claim once end-to-end, then mainnet (4114):
   ```sh
   cd smart-contracts
   JUICER_SIGNER_ADDRESS=0x... JUICER_BASE_TOKEN_URI="ipfs://<CID>/" \
   JUICER_CAMPAIGN_END=<unix> JUICER_MAX_SUPPLY=<n> DEPLOYER_PRIVATE_KEY=0x... \
   npx hardhat run scripts/deployJuicerNFT.ts --network citreaTestnet
   ```
4. Record the printed address; confirm the on-chain `signer` line matches.

## 2. ponder — re-index mainnet

PR #139 **changes mainnet start blocks** (V3 factory 2,651,539; V2 factory
2,651,525) and **adds new indexed contracts** (JUICE equity, svJUSD savings,
MintingHub gateway + per-Position factory). This is a **full re-index**, not a
hot reload.

- **Strategy:** blue-green. Stand up a new ponder instance against a fresh DB,
  let it backfill to head, then cut the api's `PONDER_URL` over. Avoids serving
  partial points during backfill.
- The `/points` and `/points/leaderboard` endpoints already return **503
  "Indexer not ready"** until `blockProgress` exists (finality gate) — safe to
  expose during backfill; they just won't 200 until caught up.
- Estimate backfill time on testnet first; size the cutover window from it.

## 3. api — deploy with Juicer env

Set before rollout (see `.env.example`):
```
JUICER_NFT_CONTRACT_MAINNET=0x...        # from step 1
JUICER_NFT_CONTRACT_TESTNET=0x...
JUICER_SIGNER_PRIVATE_KEY=0x...          # address == contract signer
JUICER_DISCORD_CALLBACK_URL=https://api.juiceswap.com/v1/campaigns/juicer/discord/callback
```
Register `JUICER_DISCORD_CALLBACK_URL` as a redirect URI in the Discord app.
Run `prisma migrate deploy` (adds `JuicerCampaignUser`, `JpSpend`, and the
`DiscordOAuthSession.callbackUrl` column). Smoke-test
`GET /v1/campaigns/juicer/progress?walletAddress=0x...` returns 200.

## 4. bapp — flip the flag

- Confirm `REACT_APP_UNISWAP_GATEWAY_DNS` (or override) points at the api host
  serving the Juicer routes; the frontend reads the contract address from the
  `/nft/signature` response, so no address constant to edit.
- Set `REACT_APP_JUICE_POINTS_PROGRAM=true` in prod env and deploy.

## 5. e2e acceptance (on dev before prod)

1. Swap via a JuiceSwap router → `/points/:addr` swaps count rises (capped 10/day).
2. Add ≥$10 LP in a whitelisted pool → liquidity day-credit accrues.
3. Create a launchpad meme token → +500 JP; `memeTokenCreated` true.
4. `POST /v1/campaigns/juicer/spend` (5,000 JP) → `jpSpent` true; retry is idempotent.
5. Verify X + Discord (Juicer role) → both conditions complete.
6. `GET /nft/signature` → `JuicerNFT.claim(signature)` mints on **testnet**.
7. Leaderboard total for the wallet == its own `/points` breakdown total.

## 6. Monitoring / alerts

- `/points` and `/points/leaderboard`: 5xx rate + p95 latency (leaderboard is a
  full-table CTE behind a 30s cache — watch for cache stampede).
- api `/v1/campaigns/juicer/*`: error rate; alert on `/nft/signature` 5xx and on
  503 "Points service unavailable" spikes (Ponder down → spends fail closed).
- Indexer lag: `blockProgress` head vs chain head.

## 7. Open product decisions (resolve before public launch)

- Twitter verification: honor-system `mark-followed` (current) vs real X OAuth.
- Capital rewards (hold/save/lend) are **uncapped** and scale linearly with $
  and across wallets — accept, or add per-$/per-wallet caps + sybil controls.
- JuicerNFT `maxSupply`, metadata, campaign window.
- Mainnet re-index downtime tolerance.
