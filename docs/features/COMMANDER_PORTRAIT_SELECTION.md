# Cosmetic commander portrait selection (PR #160)

Status: Implemented in feature branch, pending QA and manual acceptance. Do not merge into main.

## Approved UX and gameplay invariant
- The **existing Roster / Отряд screen and its six-card layout remain completely unchanged**. Only the existing Run King's title, portrait and biography reflect the player's cosmetic choice.
- The existing New Journey name modal now has a gallery with seven portraits from `game/assets/kings/<id>/portrait.png`. Default: Oathkeeper. The player still enters a free run name.
- Choices: oathkeeper, stone_crown, wanderer_queen, pilgrim, fox_prince, ash_regent and nameless_heir. Russian and English biographies and labels.
- **Cosmetic only.** No new powers, game mechanics, balancing, board sprites, or King gameplay identities. The stable King ID remains `king.oathkeeper`.

## Data / backward compatibility
- A whitelisted `run.commanderId` survives saves and reloads. Legacy and malformed IDs safely default to `oathkeeper`.
- Local Chronicle completed-run records store the chosen commander; active run and best run thumbnails are presented inside the existing blue royal flag.
- The public Great Commanders leaderboard has a safe `commanderId` per row and personal entry, mapped by the client to whitelisted image paths. No user-supplied URLs are used.
- The existing D1 requires an **additive migration**: `commander_id TEXT NOT NULL DEFAULT 'oathkeeper'`. Existing player scores and ranks are retained. The migration must run before deploying the new Worker.
- Old results use Oathkeeper until a better authenticated result is submitted. Scores and signed VK account verification do not change.

## Image budgets and loading
- All seven original HQ king portraits remain untouched in GitHub.
- The established runtime optimizer now includes all seven king portraits in the 43-file portrait set (36 heroes + 7 kings). The existing bounds of 640px side and 1536KiB per portrait apply to deployed copies.
- The conditional asset loader covers the open commander gallery; visible images are predecoded before removing the mask, without flashing on cached transitions.

## New Journey modal — gold palette and vertical alignment (2026-10-17)
- In the name/commander selection modal, both portrait-option cards and the selected-commander preview use the existing obsidian/gold theme, not blue card surfaces or borders. The royal-blue Chronicle flag is unchanged.
- Selected portrait and biography are centered vertically within the right-hand preview panel. Landscape desktop/tablet, compact-landscape and stacked narrow-screen layouts retain their existing responsive structure.
- A new CSS URL version bypasses cached blue styling. The existing Chronicle/identity browser check now verifies warm borders and portrait/biography centering at 1313 × 641.
- Gameplay, save format, seven portrait choices and the Roster screen remain unchanged.

## QA / acceptance
- Existing identity and Chronicle regression checks cover seven assets, validation, save/reload, bilingual biographies, local history and leaderboard whitelist.
- The RU/EN browser test checks the gallery and compact portraits.
- Manual checks: all seven portraits and name entry on desktop and landscape mobile, unchanged Roster screen, persistence, current Chronicle, player rank and public leaderboard.
- **Do not merge PR #160** before explicit user acceptance.
