# RPChess — VK Games v1 implementation plan

**Status:** APPROVED  
**Approved:** 2026-09-15  
**VK App ID:** `54754579`  
**Release scope:** **VK Web + VK Mobile**, one HTML5 codebase  
**Delivery:** `main` → canonical `dist/` → GitHub Pages → VK iframe/WebView

This file is the canonical implementation handoff for the VK v1 release. Another developer/agent should be able to continue directly from the unchecked items below.

## Goal

Prepare the first full VK Games release of RPChess with:

- cross-device cloud save for the same VK user;
- Power leaderboard with Global / Friends views;
- sharing of run results;
- rewarded and interstitial ads;
- one-time contextual onboarding after the first New Game;
- VK Web and VK Mobile support from the same HTML5 build;
- moderation, licensing and payout readiness.

## Out of scope for v1

- [ ] Purchases / Votes / store / item orders.
- [ ] Separate Android APK/AAB.
- [ ] Separate iOS IPA/App Store build.
- [ ] Steam integration.
- [ ] Full authoritative game backend.
- [ ] Advanced anti-cheat beyond reasonable server-side validation for leaderboard writes.

## Ownership legend

- `[DEV]` — autonomous code/repo/test/documentation work.
- `[OWNER]` — requires project-owner action, secret, legal/account action or acceptance.
- `[TOGETHER]` — developer prepares it, owner performs the final real-client/manual verification.
- `BLOCKER` — do not submit the moderation candidate until closed.

---

# 0. Ready baseline

- [x] VK app exists: `54754579`.
- [x] RPChess launches inside VK.
- [x] Canonical delivery is GitHub Pages embedded by VK.
- [x] `VKWebAppInit` works.
- [x] Shared Web/VK platform boundary exists.
- [x] Lifecycle pause/resume exists.
- [x] Core persistence uses the shared storage boundary.
- [x] Suno Free background tracks were removed.
- [x] Music catalog is generated automatically from `game/music/`.
- [x] Stockfish license/source handling is documented.
- [x] BrahmsGotischCyr / SIL OFL attribution is documented.
- [x] Lichess puzzles / CC0 attribution is documented.
- [x] Victory fanfare provenance is documented: `_MC5_`, `Short Brass Fanfare 1`, Freesound sound `524849`, CC BY 4.0.
- [x] Production visual provenance is documented as project-specific artwork generated with ChatGPT/OpenAI image-generation tools under the owner's direction.
- [x] RPChess is visible in the VK payout cabinet.

---

# 1. VK API capability spike

Do this before large integration work so implementation matches the real App ID and current VK platform behavior.

## 1.1 VK Storage

- [ ] `[DEV]` Verify current VK Storage methods for Web and Mobile.
- [ ] `[DEV]` Verify actual limits for value size, key count and error behavior.
- [ ] `[DEV]` Verify Storage against a real VK Web launch.
- [ ] `[DEV]` Use chunking only if the measured/current limits require it.

## 1.2 Ads

- [ ] `[DEV]` Verify rewarded support.
- [ ] `[DEV]` Verify interstitial support.
- [ ] `[DEV]` Verify ad-availability probing.
- [ ] `[DEV]` Normalize `completed`, `closed`, `unavailable`, `error` responses.
- [ ] `[DEV]` Build deterministic mocks before relying on real inventory.

## 1.3 Leaderboard

- [ ] `[DEV]` Verify `apps.getLeaderboard` for Global results.
- [ ] `[DEV]` Verify Friends results.
- [ ] `[DEV]` Verify extended user data needed for avatar/name rows.
- [ ] `[DEV]` Verify the authorization required to read leaderboard data in Web/Mobile.
- [ ] `[DEV]` Verify the server-side `secure.addAppEvent` write path.
- [ ] `[DEV]` Verify exact `level` / `points` semantics.

### Power decision gate

Current RPChess Power is Elo-like and can both rise and fall.

- [ ] `[DEV]` Verify whether the native VK leaderboard can represent the **current** Power when Power decreases.
- [ ] If yes: use Current Power as approved.
- [ ] If VK only preserves maximum/cumulative score: **stop leaderboard implementation and ask the owner** to choose between native Best Power and a custom Current Power leaderboard. Do not silently change the metric.

**Acceptance:** no unknown VK API limitation remains before implementing Cloud Save / Ads / Leaderboard.

---

# 2. Expand PlatformAdapter

Gameplay modules must not call VK Bridge/API directly.

- [ ] `[DEV]` Add/normalize `platform.storage.local`.
- [ ] `[DEV]` Add `platform.storage.cloud`.
- [ ] `[DEV]` Add `platform.ads`.
- [ ] `[DEV]` Add `platform.social`.
- [ ] `[DEV]` Add `platform.leaderboard`.
- [ ] `[DEV]` Add `platform.identity`.
- [ ] `[DEV]` Keep `platform.lifecycle` as the shared lifecycle owner.
- [ ] `[DEV]` Add safe Web fallbacks for every VK-only capability.
- [ ] `[DEV]` Add capability detection per optional VK method.
- [ ] `[DEV]` Ensure unavailable VK functions never produce fatal gameplay errors.
- [ ] `[DEV]` Log platform errors without exposing secrets.

## Feature flags

- [ ] `[DEV]` Cloud save flag.
- [ ] `[DEV]` Rewarded flag.
- [ ] `[DEV]` Interstitial flag.
- [ ] `[DEV]` Sharing flag.
- [ ] `[DEV]` Leaderboard flag.
- [ ] `[DEV]` Onboarding flag.
- [ ] `[DEV]` Allow production ads to be disabled without changing gameplay code.

---

# 3. VK Cloud Save

## 3.1 Synced domains

Synchronize:

- [ ] active run;
- [ ] roster and hero statuses;
- [ ] gold;
- [ ] supplies;
- [ ] current route / resumable encounter state;
- [ ] run statistics;
- [ ] Power;
- [ ] Chronicle / persistent progression;
- [ ] onboarding flags;
- [ ] rewarded claim receipts;
- [ ] minimal leaderboard-sync state required for idempotency.

Keep device-local:

- [ ] volume / mute;
- [ ] presentation-only settings;
- [ ] transient DOM/UI state;
- [ ] static descriptions and asset paths;
- [ ] unnecessary historical Elo receipts.

## 3.2 CloudSaveV1 schema

- [ ] `[DEV]` Create versioned `CloudSaveV1`.
- [ ] Include schema version.
- [ ] Include monotonic revision.
- [ ] Include `updatedAt`.
- [ ] Include active run/profile/tutorial/ad-receipt domains.
- [ ] `[DEV]` Compact serialization.
- [ ] `[DEV]` Chunk only if required by verified VK limits.
- [ ] `[DEV]` Add manifest/checksum for multi-key writes if chunked.
- [ ] `[DEV]` Write manifest last so partial writes are never treated as valid complete saves.

## 3.3 Local + cloud behavior

Every gameplay save remains local-first:

1. save locally;
2. queue asynchronous cloud write;
3. cloud failure does not interrupt gameplay.

- [ ] `[DEV]` Debounce cloud writes.
- [ ] `[DEV]` Best-effort flush on lifecycle/page hide.
- [ ] `[DEV]` Retry temporary failures.
- [ ] `[DEV]` Keep standalone GitHub Pages fully playable with local-only persistence.

## 3.4 First sync and conflicts

- [ ] Cloud empty + local valid → upload local.
- [ ] Local empty + cloud valid → restore cloud.
- [ ] Same runId → reconcile by revision/validity.
- [ ] Different active runIds → show a minimal conflict chooser.
- [ ] Conflict UI shows local/cloud date, week and Power.
- [ ] Owner-selected copy becomes authoritative and is written back to both stores.
- [ ] Never silently destroy the newer valid state.

## 3.5 Cross-device acceptance

- [ ] `[TOGETHER]` Start run on device A.
- [ ] Open same VK account on device B.
- [ ] Confirm the same run resumes.
- [ ] Make progress on B.
- [ ] Return to A and confirm B's newer state restores.

---

# 4. First-run contextual onboarding

## 4.1 Rules

- [ ] On the first-ever `Новая игра / New Game`, activate onboarding.
- [ ] Each included screen/type shows one short overlay on its first visit.
- [ ] Each overlay explains what this screen is and what the player can do there.
- [ ] One normal `Понятно / Got it` dismissal button.
- [ ] No global `Skip tutorial`.
- [ ] No persistent `?` help button.
- [ ] Dismissed hints never repeat for that user.
- [ ] Tutorial flags sync through Cloud Save.

## 4.2 Included onboarding screens

- [ ] Player Identity / start of run.
- [ ] Travel / route cards.
- [ ] Roster / party.
- [ ] Skirmish preparation.
- [ ] Skirmish chess screen.
- [ ] Battle preparation.
- [ ] Battle chess screen.
- [ ] Event.
- [ ] Settlement.
- [ ] Puzzle.

**Explicitly excluded from onboarding:**

- Hunger / Starvation;
- Chronicle;
- Run End / final run screen;
- Skirmish Result / aftermath;
- Battle Result / aftermath.

No onboarding work or onboarding-specific viewport tests are required for those excluded screens.

## 4.3 Onboarding UI/tests

- [ ] `[DEV]` One reusable tutorial-overlay component.
- [ ] RU copy for every included screen.
- [ ] EN copy for every included screen.
- [ ] Correct focus/accessibility behavior.
- [ ] Included overlays fit desktop viewport.
- [ ] Included overlays fit compact `844×390` without internal scrolling.
- [ ] Included overlays fit VK Mobile landscape.

---

# 5. Advertising platform layer

- [ ] `[DEV]` All ad calls go through `platform.ads`.
- [ ] `[DEV]` Probe availability before every show attempt.
- [ ] `[DEV]` Normalize `completed`, `closed`, `unavailable`, `error`.
- [ ] `[DEV]` Ad failure never blocks normal game progression.
- [ ] `[DEV]` Reward is granted only on confirmed successful rewarded completion.
- [ ] `[DEV]` Reward mutations are idempotent.

---

# 6. Interstitial every fifth Travel selection

## 6.1 Trigger

- [ ] Count only committed Travel-card selections.
- [ ] Use committed `journeyStep` semantics.
- [ ] Due at 5, 10, 15, 20, ...

## 6.2 Safe show point

Flow:

`Travel selection → persist route/save → advertising gate → next scene`

- [ ] Never show before the route is persisted.
- [ ] Never show mid-combat.
- [ ] Never show over a combat-result screen.
- [ ] Route progression never depends on successful ad delivery.

## 6.3 Rewarded priority/cooldown

- [ ] Starvation rescue rewarded takes priority over a due interstitial.
- [ ] No interstitial for 60 seconds after any rewarded ad.
- [ ] Conflicting interstitial becomes `pending` rather than being double-served.
- [ ] Pending interstitial waits for the next safe transition after cooldown.
- [ ] Never auto-pop an interstitial in the middle of an encounter merely because the timer expired.

---

# 7. Rewarded: double combat gold

## Battle

- [x] Normal reward is granted immediately.
- [x] Aftermath offers `×2 золота за просмотр рекламы / Double gold by watching an ad`.
- [x] Successful rewarded adds exactly one extra copy of that encounter's original gold reward.
- [x] Close/error/unavailable never removes the normal reward.
- [x] One claim per encounter.

## Skirmish

- [x] Same normal-reward-first contract.
- [x] Same one-extra-copy reward.
- [x] One claim per encounter.
- [x] `[DEV]` Reward-row re-renders restore the canonical ×2 offer in both Skirmish and Battle aftermath screens.
- [x] `[DEV]` Native rewarded shows use an ad-specific completion timeout instead of the generic 7-second Bridge timeout.
- [x] `[TOGETHER]` Real VK Web smoke on Hosting version `1789552334`: rewarded video completes and the extra combat Gold is granted.

## Idempotency

Receipt contains at least:

- [x] runId;
- [x] encounter type;
- [x] encounter sequence/id;
- [x] reward amount.

- [x] Reload cannot claim again.
- [ ] Cross-device cloud resume cannot claim again.

---

# 8. Rewarded: starvation rescue

## 8.1 Trigger

Show only when:

1. the player selected a Travel card;
2. current Supplies cannot pay the route cost;
3. the existing starvation flow is about to begin.

Do **not** trigger merely because Supplies become zero after a successfully paid route.

## 8.2 Offer

- [x] Explain that Supplies are insufficient.
- [x] Offer `Получить 5 припасов / Get 5 Supplies` via rewarded ad.
- [x] Offer normal continuation without ad.

## 8.3 Successful rewarded

- [x] Grant +5 Supplies.
- [x] Immediately pay the current route cost from those Supplies.
- [x] Persist the result.
- [x] Do not start starvation for that transition.
- [x] Continue to the already selected encounter.

At current route cost 1: `0 → +5 → -1 → 4` remaining.

## 8.4 Decline/error

- [x] No extra punishment.
- [x] Continue into the existing starvation flow unchanged.

## 8.5 Idempotency

- [x] One rescue receipt per route selection.
- [x] Reload during/after ad cannot manufacture repeated Supplies.

---

# 9. Share run result

## 9.1 Entry point

- [x] Add `Поделиться результатом / Share result` to the final run summary.
- [x] `[DEV]` Route Battle/Skirmish King-death endings through the same canonical share-enabled final summary as every other run ending.

## 9.2 Shared content — use emoji actively

The result should feel like a compact social achievement, not a dry telemetry dump. Include relevant emoji in both RU and EN copy, for example:

- [x] 👑 King / player identity;
- [x] 🗓️ weeks / journey length;
- [x] ⚔️ Battle wins;
- [x] 🛡️ Skirmish wins;
- [x] 🧩 puzzles solved;
- [x] 📜 events resolved;
- [x] 👥 heroes recruited;
- [x] 🔥 final Power;
- [x] ☠️ **King death / end reason**;
- [x] 🎮 link/deep link to RPChess in VK.

Exact emoji may be adjusted for readability, but the v1 share text should use them actively and remain compact.

## 9.3 Localization/platform behavior

- [x] RU share copy.
- [x] EN share copy.
- [x] Open VK wall publication through `VKWebAppShowWallPostBox`.
- [x] Do **not** fall back to the private-message `VKWebAppShare` dialog.
- [x] Final fallback: Copy Result / Copy Link.
- [x] Share cancel/failure never breaks the final screen.
- [x] v1 is text + link; generated image cards are deferred.
- [ ] `[TOGETHER][BLOCKER]` Confirm that `VKWebAppShowWallPostBox` creates the post on the player's own wall after VK moderation. The 2026-09-16 pre-moderation Web smoke reached the correct VK wall method, but VK rejected it with «Приложению недоступно создание постов»; do not replace this with private-message sharing.

## 9.4 Post-smoke owner corrections

- [x] `[DEV]` Victory fanfare uses the externally hosted licensed MP3 in VK builds, where Hosting excludes bundled audio.
- [x] `[DEV]` Chronicle no longer shows «Новое имя ещё ждёт своей дороги.» when no run is active.
- [x] `[DEV]` Positive Power gain is halved for Skirmish wins and divided by three for Training wins; losses keep the canonical Elo penalty.
- [x] `[DEV]` A new run starts at 75% of the previous run's final Power.
- [x] `[DEV]` Material-training objectives display the target piece glyph instead of its written name.

---

# 10. VK Leaderboard

## 10.1 Metric

- [x] Approved primary metric: **Power**.

## 10.2 In-game UI

Add `Рейтинг / Leaderboard` with:

- [ ] Global tab;
- [ ] Friends tab;
- [ ] place;
- [ ] avatar;
- [ ] player name;
- [ ] Power;
- [ ] explicit own result / own place.

## 10.3 Read path

- [ ] `[DEV]` Read native VK leaderboard data.
- [ ] `[DEV]` Loading state.
- [ ] `[DEV]` Error state.
- [ ] `[DEV]` Empty state.
- [ ] `[DEV]` Short-lived cache to avoid unnecessary repeated calls.

## 10.4 Write path

Service secret must never reach the browser.

`RPChess → Cloudflare Worker → VK secure.addAppEvent`

- [ ] `[DEV]` Create minimal Cloudflare Worker.
- [ ] Use Cloudflare Workers Free plan for v1.
- [ ] `[OWNER]` Add VK service credential as Worker Secret when required.
- [ ] Never place the secret in GitHub, browser JS, documentation or chat.

## 10.5 Worker validation

- [ ] Validate signed VK launch params.
- [ ] Derive/trust user identity only from validated VK context.
- [ ] Validate app id.
- [ ] Rate limit.
- [ ] Idempotency by rating receipt.
- [ ] Validate reasonable Power range.
- [ ] Validate reasonable rating delta.
- [ ] Never log secrets.

## 10.6 Anti-cheat scope

v1 is best-effort protection only:

- [ ] replay protection;
- [ ] basic delta validation;
- [ ] rate limiting;
- [ ] no full authoritative game backend.

## 10.7 Power limitation gate

If the native VK leaderboard cannot represent decreasing Current Power:

- [ ] stop implementation at this gate;
- [ ] present concrete alternatives to the owner;
- [ ] do not silently switch to Best Power.

---

# 11. VK Web + VK Mobile

## 11.1 Architecture

- [x] One HTML5 gameplay codebase.
- [ ] One canonical production build.
- [ ] One PlatformAdapter.
- [ ] Same Cloud Save semantics on Web and Mobile.
- [ ] No mobile gameplay fork.

## 11.2 VK Web validation

- [ ] Desktop VK iframe smoke.
- [ ] Direct GitHub Pages fallback smoke.
- [ ] Normal desktop viewport.
- [ ] `844×390` compact regression.

## 11.3 VK Mobile definition

**VK Mobile means the same HTML5 RPChess running inside the VK Android/iOS client WebView/mobile surface. It does not mean APK/AAB/IPA.**

- [ ] `[DEV]` Mobile URL uses the same canonical production.
- [ ] `[DEV]` Verify Bridge capability differences.
- [ ] `[DEV]` Verify touch/focus/audio/lifecycle.
- [ ] `[DEV]` Verify Cloud Save.
- [ ] `[DEV]` Verify rewarded/interstitial ads.
- [ ] `[DEV]` Verify sharing.
- [ ] `[DEV]` Verify leaderboard.
- [ ] `[DEV]` Verify onboarding included screens.

## 11.4 Orientation

RPChess is landscape-oriented.

- [ ] Verify VK Mobile landscape.
- [ ] Verify portrait behavior.
- [ ] If portrait cannot preserve gameplay UI, show a clean `Поверните устройство / Rotate your device` overlay instead of broken combat UI.
- [ ] Returning to landscape restores the current game without reload.

## 11.5 Real-client acceptance

Before declaring Mobile in the candidate:

- [ ] `[TOGETHER]` Real VK Android client critical smoke.
- [ ] `[TOGETHER]` Real VK iOS client critical smoke.
- [ ] If one platform cannot be physically tested by the owner, obtain a real-client test for that platform before submitting Mobile.

---

# 12. Privacy / Terms / Support

Prepare after the real data flow is implemented so legal copy matches reality.

## Privacy Policy

- [ ] VK user identification.
- [ ] VK Cloud Save usage.
- [ ] Leaderboard score handling.
- [ ] Cloudflare Worker role.
- [ ] Advertising integration.
- [ ] State what RPChess does **not** collect/store independently where applicable.

## User Agreement / Terms

- [ ] usage terms;
- [ ] intellectual property;
- [ ] availability/no-warranty clauses as appropriate;
- [ ] external VK services;
- [ ] advertising.

## Support

- [ ] `[OWNER]` Confirm public support e-mail.
- [ ] `[DEV]` Publish support/legal pages.
- [ ] `[DEV]` RU/EN where required by the VK card/form.

---

# 13. Payout / advertising cabinet

- [x] RPChess is already present in VK payout cabinet.
- [ ] `[OWNER]` Assign the required executor if VK requires it for payouts.
- [ ] `[OWNER]` Accept required offers/terms.
- [ ] `[OWNER]` Confirm the app is enabled for the intended advertising monetization.
- [ ] `[TOGETHER]` Verify first test impressions/statistics.
- [ ] Do not consider production ad economy ready until cabinet configuration is valid.

---

# 14. Automated tests — Minimal Testing Policy

Prefer extending existing owner/regression tests. Create a new permanent suite only where no existing test can prove the contract.

## 14.1 Unit / contract coverage

- [ ] Platform capability/fallback behavior.
- [ ] Cloud serialization.
- [ ] Cloud reconciliation.
- [ ] Save conflict selection.
- [ ] Tutorial flags for **included onboarding screens only**.
- [ ] Interstitial scheduler.
- [ ] 60-second rewarded cooldown.
- [x] Reward receipt idempotency.
- [x] Double-gold mutation.
- [ ] Starvation rescue mutation.
- [ ] Share text RU with emoji/end reason.
- [ ] Share text EN with emoji/end reason.
- [ ] Leaderboard adapter.
- [ ] Worker request validation.

## 14.2 Browser mocked-VK coverage

- [ ] Storage success/unavailable/error.
- [ ] Rewarded completed/closed/unavailable/error.
- [ ] Interstitial success/error.
- [ ] Share success/cancel/fallback.
- [ ] Leaderboard loading/error.
- [ ] Lifecycle during ad.
- [ ] Reload after rewarded claim.
- [ ] Reload after cloud save.

## 14.3 Viewport coverage

Onboarding viewport tests apply only to screens listed in **4.2 Included onboarding screens**.

- [ ] Included onboarding overlays — desktop.
- [ ] Included onboarding overlays — `844×390`.
- [ ] Included onboarding overlays — VK Mobile landscape.
- [ ] Rewarded UI/modal `844×390` where applicable.
- [x] Final run summary uses actual iframe height and fits landscape viewport without page scrolling.
- [ ] Starvation-rescue offer `844×390`.
- [ ] Leaderboard `844×390`.
- [ ] Mobile landscape.
- [ ] Portrait rotate overlay.

There are **no onboarding-specific tests** for Hunger, Chronicle, Run End, Skirmish Result or Battle Result.

---

# 15. Manual VK Web end-to-end smoke

- [ ] First launch.
- [ ] New Game.
- [ ] Included onboarding hints.
- [ ] Travel selection.
- [ ] Skirmish.
- [x] Rewarded ×2 after Skirmish.
- [ ] Battle.
- [x] Rewarded ×2 after Battle.
- [x] Victory fanfare is audible in the real VK Web build.
- [ ] Fifth committed Travel selection → interstitial.
- [ ] Insufficient Supplies → rescue rewarded.
- [ ] Event.
- [ ] Settlement.
- [ ] Puzzle.
- [ ] Chronicle normal behavior (not onboarding).
- [ ] Power update.
- [ ] Leaderboard update.
- [ ] Global leaderboard.
- [ ] Friends leaderboard.
- [ ] Cloud reload/resume.
- [x] Run end.
- [x] King death reason.
- [ ] Share result with emoji.
- [x] RU.
- [ ] EN.

---

# 16. Manual VK Mobile smoke

Repeat the critical path in the real VK mobile client:

- [ ] launch;
- [ ] cloud resume;
- [ ] Travel;
- [ ] combat;
- [ ] touch controls;
- [ ] audio;
- [ ] background → foreground;
- [ ] rewarded;
- [ ] interstitial;
- [ ] starvation rescue;
- [ ] sharing;
- [ ] leaderboard;
- [ ] included onboarding screens;
- [ ] landscape;
- [ ] rotation;
- [ ] reload;
- [ ] cross-device sync.

---

# 17. Moderation candidate

- [ ] Freeze exact `main` SHA.
- [ ] Run `npm run gate:local`.
- [ ] Build canonical production `dist/`.
- [ ] Run release-critical browser smoke.
- [ ] Deploy that exact SHA to GitHub Pages.
- [ ] Verify exact SHA through VK Web.
- [ ] Verify exact SHA through VK Mobile.
- [ ] Re-run candidate license/provenance audit.
- [x] Record exact titles, authors, Freesound sources and licenses for `epic_music1..4.mp3` in shipped and repository attribution files.
- [ ] `[OWNER][BLOCKER]` Resolve `epic_music3.mp3`: remove/replace it or provide a separate commercial license from AudioCoffee; Freesound lists the track as CC BY-NC 4.0.
- [ ] Confirm Privacy / Terms / Support URLs.
- [ ] Complete VK card fields and marketing assets.
- [ ] Confirm age rating.
- [ ] Confirm public title.
- [ ] Confirm support contact.
- [ ] Confirm payout/ad configuration.

Do not change code between final smoke and submission without creating a new candidate SHA and re-running the relevant gates.

---

# 18. Submission

- [ ] `[TOGETHER]` Final VK Web launch.
- [ ] `[TOGETHER]` Final VK Mobile launch.
- [ ] `[OWNER]` Final card review.
- [ ] `[OWNER]` Final payout-cabinet review.
- [ ] `[DEV]` Prepare concise moderation notes describing cloud save, ads, leaderboard, sharing and Web/Mobile support.
- [ ] `[OWNER]` Submit to VK moderation.
- [ ] If moderation returns feedback, record exact feedback and fix narrowly with relevant regression + candidate gate.

---

# Definition of Done — VK Games v1

All must be true:

- [ ] the same VK user can continue the same run across devices;
- [ ] Power syncs correctly;
- [ ] Global and Friends leaderboard work;
- [ ] run result can be shared;
- [ ] share copy uses emoji and includes the King death reason;
- [ ] interstitial is scheduled every fifth committed Travel selection;
- [ ] rewarded doubles only the just-completed combat reward;
- [ ] starvation rescue grants 5 Supplies and pays the selected route;
- [ ] normal reload/cross-device resume cannot duplicate rewarded benefits;
- [ ] onboarding appears once for every **included** screen and nowhere in the explicitly excluded set;
- [ ] VK Web passes full smoke;
- [ ] VK Mobile passes real-client smoke;
- [ ] landscape UI remains usable and portrait is handled safely;
- [ ] cloud/ad/VK API failure never makes the game unplayable;
- [ ] license/provenance/credits are closed;
- [ ] Privacy / Terms / Support are ready;
- [ ] payout configuration is ready;
- [ ] exact moderation candidate passes release gates;
- [ ] candidate is submitted to VK moderation.
