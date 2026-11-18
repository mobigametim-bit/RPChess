# Tournament rated wins → Honor Shards equal positive Elo gain (18.11.2026)

**State:** branch implementation, pending focused / local Worker verification and owner manual acceptance. **Branch:** `feature/tournament-elo-honor-shards-20261118`. **Base main:** `2712e3aa465961ba2f52d2a3ca47d24dfff5a0c6`.

## Approved economic rule

For a **verified VK ranked public-queue** Tournament result already settled by the server:

| Outcome | Tournament Power | Honor Shards |
|---|---|---|
| Win | `ΔElo = round(32 × (1 − expectedScore))` | `max(0, ΔElo)` |
| Loss | Current negative / zero Elo calculation unchanged | **0**, never debit existing shards |
| Draw | Current Elo calculation unchanged (can be positive/negative) | **0** |
| Private invitation / guest / match beyond existing same-pair rated cap / local Shadow | No ranked settlement | **0** |

Examples: 500 vs 500 rated win: **+16 Elo, +16 Honor Shards**. Equal-rated loss: **−16 Elo, 0 shard deduction**. When an extremely high-rated winner gains **0 Elo** due to rounding, award **0** shards.

## Existing anti-farm and server authority preserved

- Match is ranked only for **two verified VK identities in the public queue**; never for private invitations, guest players, or Shadow.
- Existing **at most 2 ranked matches per same VK pair per rolling 24 hours** remains unchanged. All further matches in that window are casual with **0 shards**.
- The only authoritative rating result comes from `TournamentMatch.settle()` → private `TournamentAccount /settle`. Server computes `record.shards` within the **same account transaction** as the existing idempotent Elo receipt. Existing receipt IDs `tournament:<matchUUID>:<color>` prevent replay across snapshot polling, browser reload or concurrent settlement.
- Historical server receipts **without** `shards` are unchanged: no retroactive payout on reconnect. No client claim of Elo or shard amount is accepted by the Tournament Worker.

## Shared Arena / Journey ledger

- `game/js/arena-core.mjs`: a new `tournament-win` event for one rating receipt ID `<receiptId>:shards` credits the immutable `shards` amount once. Validate the internal server receipt shape and existing K=32 Elo arithmetic. `arenaSummary` continues to derive the global currency from the same `rpchess.reboot.v1.arena` event list used by Arena, weekly Journey tasks and buildings. All existing transactions and prices remain unchanged.
- `game/js/tournament-app.mjs`: after verifying the authenticated finished-match receipt and importing Elo, attempt the shard credit. Trigger existing `rpchess:arena-updated` so the existing Profile cloud autosave can include the event. If local storage fails, never display it as paid; retry when server's immutable receipt is read again.
- Display earned shards in the RU/EN result screen. In losses/draws explicitly tell players shards are **not deducted**. Historical server receipts without award fields show no confirmed payment.
- **Trust boundary note:** server account receipts and ranked settlement are authoritative. The shared Arena/Journey ledger is currently a client-side local/cloud event ledger; field-consistency checks are not cryptographic attestation against manually editing localStorage. A future fully server-enforced shard balance / purchase model would need a server-owned economy ledger and profile-level redemption. This feature does not pretend otherwise or open a public minting endpoint.

## Confirmed linked VK identity settlement defect

Existing `TournamentAccount /settle` allowed only a legacy opponent identity `vk:<numericUserId>`, while the canonical Profile-linked Tournament issues **verified** `rpchess:<uuid>` account IDs. The match was rightly ranked, but its final Elo settlement could reject the opponent ID before recording a reward. Without addressing this, the requested shard rewards could not reliably work for real linked VK accounts.

The internal-only settlement now accepts both server-created verified identity formats. It never accepts a client-injected arbitrary identity or exposes this endpoint publicly. An additional assertion sequence in existing `tests/tournament-profile-link-local.mjs` settles a real locally simulated two-profile ranked match, verifies +16 Elo/+16 shards to the winner and -16 Elo/0 shards to the loser, and confirms immutable receipts on reconnect. Local CI starts the disposable profile-linked Worker with a fake profile origin; no real account/D1 is contacted.

## Tests (minimal expansion of existing suites)

- Extend `tests/arena.cjs`: +16 rated-win award and unique receipt across reload and cloud merge; no subtraction on losses, draws or unsigned/ineligible historical receipts.
- Extend `tests/tournament-rated-local.mjs` and existing `tests/tournament-profile-link-local.mjs`: actual local Wrangler DOs with disposable VK signatures; first ranked same-rating win returns `shards=16`, loss `shards=0`, repeated snapshot is immutable, third same-pair match and invites mint no rating or shards.
- Extend existing `.github/workflows/tournament-worker-check.yml` on feature branch to dry-run Worker and run existing local ranked test on disposable DO storage. PR Focused Checks handles the normal game tests. No new permanent test suite.

## Synthetic interactive QA — no real ratings, accounts or backend writes

The branch-only workflow `.github/workflows/tournament-shards-preview.yml` builds the real game client and publishes it on an **isolated static** Cloudflare Worker `rpchess-tournament-shards-qa-preview`. The `tournament-shards-preview/demo.js` fixture is injected **only into QA dist**, not `game/index.html` or the production build. It mocks a verified rated 500 vs 500 Tournament finish and displays a prominent QA DEMO label.

- Demo link: https://rpchess-tournament-shards-qa-preview.mobigametim.workers.dev/?tournament_shards_qa=1&rpchess_profile=0&rpchess_gamepush=0&rpchess_api_route=direct
- Open Tournament → Find opponent. The synthetic server immediately completes a result with **+16 Elo and +16 shards**; the same real client code writes into the Arena/Kingdom event ledger.
- Click **Find another opponent**; the mock deliberately replays the *same* match receipt. The balance must remain **16**, not 32.
- A Chromium smoke check asserts one award event, local Power 516, no duplicate, and **zero calls to the real canonical Tournament API**.
- This demo cannot verify genuine VK server reward delivery or D1 permissions; only the safe, disposable local Wrangler tests check server issuance.

## Deployment order / safeguards

1. Review server+client changes and inspect green focused, local Worker and full Gate tests.
2. **Before** shipping the client, release `tournament-worker/src/index.mjs` to the **existing canonical Worker** (`tournament-worker/wrangler-profile.toml`, service `rpchess-tournament-profile-preview`), keeping its existing DO IDs, origins, profile service binding and secrets. Do not replace with `wrangler.toml` (legacy separate data) or v4 isolated data. Deploy only with explicit owner approval.
3. Then merge into `main`, publish game static build via established GitHub Pages release; production VK hosting is a separate publish verification when applicable.
4. On two verified VK accounts, play a new ranked match, compare Elo and shard changes, reload, confirm no duplicates; verify loser loses no shards, and private invitation / third same-pair match remain casual.
5. If canonical Worker deployment cannot be verified, **do not declare the feature live**. New client seeing a historical or old-worker rating receipt with no `shards` will not invent payment.

**No secrets, Worker deployments, D1 migrations, production changes or owner profile mutations from this feature PR.**
