# RPChess — VK v1 social, cloud-save, ads and onboarding plan

Approved: 2026-09-15

Target app: VK Games app `54754579`  
First release platform: **VK Web**  
Delivery path: `main` → canonical `dist/` → GitHub Pages → VK iframe/WebView.

This document fixes the approved product scope before implementation. Purchases and declared VK Mobile support are deferred.

## 1. Cloud save

Goal: the same VK user can continue RPChess progress on another device/browser signed into the same VK account.

Architecture:

- `localStorage` remains the synchronous local cache/fallback for standalone GitHub Pages and temporary VK failures;
- VK users additionally sync a compact versioned save through VK Storage (`VKWebAppStorageGet` / `VKWebAppStorageSet`);
- VK Storage is treated as app/user scoped storage; no RPChess account/password system is introduced;
- cloud writes are asynchronous and must never block gameplay;
- save records carry schema/version, revision and update timestamp;
- startup reconciles local and VK copies deterministically and persists the selected newest valid state back to both stores;
- payloads are chunked conservatively rather than assuming an unlimited single-value size.

Cloud domains for v1:

- active run and roster state;
- resources and current route/encounter state required to resume safely;
- player Power;
- Chronicle / persistent progression already owned by RPChess;
- tutorial/first-visit flags.

Device-local only:

- audio volume/mute;
- other presentation preferences that do not affect game progression;
- transient UI state.

No gameplay state may exist only in cloud. If VK Storage is unavailable, the player continues locally and sync retries later.

## 2. VK leaderboard

Primary leaderboard metric: **Power**.

Power remains the existing RPChess adaptive/Elo-style player rating. Individual run length does not become the primary global ranking metric in v1.

Write path:

- scores are submitted through VK's game activity/leaderboard backend using `secure.addAppEvent`;
- the VK application/service secret must never be embedded in GitHub Pages client code;
- use a minimal serverless score-submit endpoint;
- v1 infrastructure target is **Cloudflare Workers Free**, so implementation does not require purchasing a hosting service initially;
- the endpoint validates signed VK launch parameters, app/user identity and reasonable score transitions before calling VK;
- secret/service credentials live only in Worker secrets/environment variables.

Read/display path for Web:

- fetch VK leaderboard data with the user-authorized `apps.getLeaderboard` API;
- display an RPChess-native leaderboard screen with `Global` and `Friends` modes;
- do not depend on `VKWebAppShowLeaderBoardBox` for Web UX, because the official Mini Apps helper documents that Direct Games leaderboard box for iOS/Android;
- when VK Mobile is added later, the native leaderboard box can be evaluated as an optional platform surface.

Failure policy: leaderboard failure never blocks gameplay or save loading.

## 3. Share run result

Add `Поделиться результатом / Share result` to the final run summary.

Shared text includes:

- weeks / journey length;
- Skirmish wins;
- Battle wins;
- puzzles solved;
- events resolved;
- heroes recruited;
- final Power;
- **King death/end reason**;
- link/deep link to RPChess in VK.

Use VK share/wall capabilities when available, with a safe Web fallback. v1 shares text/result + link; generated share-card images are deferred.

## 4. Advertising

All ad calls live behind `platform.ads`; gameplay code requests an intent and does not know VK-specific bridge details.

Before each show attempt, check availability. Ad errors, absence, close/cancel or VK-side limits must always fall back to normal gameplay.

### 4.1 Interstitial cadence

- increment based on committed Travel-card selections;
- show at every 5th committed selection: 5, 10, 15, 20, ...;
- show only at a scene-transition/pause point after the choice has been committed;
- never make the selected route depend on successful ad delivery;
- rewarded ads have priority;
- do not show an interstitial for 60 seconds after any rewarded ad;
- if an interstitial is due during that cooldown/conflict, defer it to the next suitable transition instead of double-serving ads.

### 4.2 Double combat gold rewarded ad

On Battle and Skirmish aftermath:

- normal earned gold is granted without ad;
- offer `×2 золота за просмотр рекламы / Double gold by watching an ad`;
- successful rewarded view grants exactly one extra copy of the gold reward from that completed encounter;
- one rewarded claim per encounter;
- persist an idempotent claim/receipt so reload/back-navigation cannot duplicate the reward;
- if no ad is available, the normal reward and Continue flow remain unchanged.

### 4.3 Starvation rescue rewarded ad

Trigger only when the newly selected Travel route cannot be paid because current Supplies are insufficient and the existing starvation flow is about to begin.

Offer:

- successful rewarded view grants `+5 Supplies`;
- the current route cost is then paid from those rescued Supplies;
- starvation is prevented for that transition;
- the remaining Supplies continue normally (for the current cost of 1, the player keeps 4);
- decline, close, ad failure or unavailable ad continues into the existing starvation flow unchanged.

Do **not** trigger simply because the visible Supplies count becomes zero after a successfully paid journey.

## 5. First-run onboarding

On the first ever `Новая игра / New Game`, enable contextual onboarding.

Rules:

- each major screen/type gets one short modal/overlay explanation on its first visit;
- explain what the screen is and the meaningful actions available there;
- user dismisses each explanation with a normal Continue/OK action;
- no global `Skip tutorial` control in v1;
- no persistent `?` help button in v1;
- once dismissed, that screen's hint does not reappear;
- tutorial flags are included in VK cloud save, so a user does not repeat them on another device;
- compact landscape hints must fit in one viewport without internal scrolling and receive browser regression coverage.

Initial hint coverage should include at least: Travel, Roster/party, Skirmish preparation, Skirmish battle, Battle preparation, Battle battle, Event, Puzzle, Settlement, aftermath/reward and starvation when first encountered.

## 6. Platform scope

### v1: VK Web

The first moderation candidate declares and tests Web only.

This does **not** mean creating a separate desktop build. RPChess remains the same HTML5 build running inside VK's desktop web iframe.

### Later: VK Mobile

`VK Mobile` in this project means making the **same HTML5 application** available and tested inside VK's Android/iOS mobile client WebView/mobile surface. It does not mean producing an APK, AAB or IPA.

A standalone Android APK/AAB or iOS IPA/App Store build would be a separate distribution project and is not required for VK Mobile support.

Before declaring Mobile later, run the complete critical smoke on real VK Android/iOS clients and fix any platform-specific Bridge/audio/layout issues.

## 7. Purchases

Deferred after v1. Do not implement Votes/items/store/order flows as part of this plan.

## 8. Payout / ads dashboard

RPChess is already visible in the VK payout cabinet as of 2026-09-15. Before enabling production ads, verify the remaining executor/payment and advertising configuration required by the current VK dashboard. This is a dashboard/financial setup task, separate from gameplay code.

## 9. Implementation order

1. Finalize PlatformAdapter request/response layer for VK Bridge methods needed by storage, API calls, share and ads.
2. Implement versioned/chunked VK cloud-save adapter and local/cloud reconciliation; add migration and failure tests.
3. Add first-run onboarding state/model and responsive overlays; sync tutorial flags.
4. Add ad orchestration/receipts and starvation rescue, then combat double-gold, then 5-route interstitial cadence.
5. Add run-result share flow with RU/EN copy and King end reason.
6. Add free-tier serverless leaderboard score-submit endpoint; keep secret out of client/repository; add client read UI for Global/Friends.
7. Run focused unit/browser tests after each slice.
8. Verify VK payout/ad configuration and enable real ad calls in test group/candidate.
9. Freeze moderation candidate SHA, run complete VK Web smoke, verify Pages exact SHA, then submit.

## 10. Non-negotiable safety/UX contracts

- ads never gate ordinary gameplay progress;
- rewarded benefits are granted only after a successful rewarded result;
- reward claims are idempotent;
- cloud failure never destroys a newer valid local save;
- secrets never enter client JS, Git history or Pages artifacts;
- leaderboard submission is server-mediated; leaderboard read failure is non-fatal;
- standalone GitHub Pages remains playable without VK features;
- RU and EN are implemented together for all new UI;
- compact landscape remains one-screen where that is already an RPChess UI contract.
