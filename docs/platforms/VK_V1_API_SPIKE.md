# RPChess — VK v1 API capability spike

**Started:** 2026-09-15  
**Implementation branch:** `feature/vk-v1-cloud-social-monetization`  
**App:** `54754579`

This document is the working record for Stage 1 of `VK_V1_SOCIAL_MONETIZATION_PLAN.md`. Only verified facts are marked closed; real-App-ID behavior remains open until tested inside VK.

## Official SDK/source findings

### VK Bridge surface

Current `VKCOM/vk-bridge` source exposes desktop/web support entries for the methods needed by the approved plan, including:

- `VKWebAppStorageGet`;
- `VKWebAppStorageGetKeys`;
- `VKWebAppStorageSet`;
- `VKWebAppShare`;
- `VKWebAppShowWallPostBox`;
- `VKWebAppCheckNativeAds`;
- `VKWebAppShowNativeAds`;
- `VKWebAppShowLeaderBoardBox`;
- `VKWebAppCallAPIMethod` / auth-related bridge methods.

The official bridge implementation uses `request_id` to resolve async request/response pairs. RPChess should use the same request-correlation contract rather than fire-and-forget calls for cloud/ad/social features.

### VK Storage

The VK Mini Apps API reference documents Storage Get/Set/GetKeys for **iOS, Android and Web**. `StorageGetKeys` documents a maximum `count` of 1000 keys per request.

Still to verify before the CloudSave schema is finalized:

- actual current per-value byte/character limit;
- actual current per-app/user storage quota;
- error returned when a limit is exceeded;
- behavior on RPChess App ID `54754579` in VK Web and VK Mobile.

No chunk size will be hard-coded until these limits are verified.

### Ads

Current VK Bridge source exposes both `VKWebAppCheckNativeAds` and `VKWebAppShowNativeAds` on Web. Existing ecosystem usage confirms the two formats required by the product plan are named `interstitial` and `reward`.

Still to verify on App ID `54754579`:

- actual availability response shape;
- completed vs closed/error response semantics;
- test inventory availability before moderation;
- Web vs Android/iOS behavior.

RPChess must not treat a historical `CheckNativeAds` result as proof that a show call will succeed; the runtime adapter must handle show failure safely.

### Leaderboard

The product metric remains **Power**, subject to the explicit decision gate in the implementation plan.

Still to verify on the real app:

- `apps.getLeaderboard` Global result;
- Friends filtering/result;
- user/avatar fields available to the client read flow;
- server-side `secure.addAppEvent` submission;
- exact `points` / `level` update semantics;
- most importantly: whether a lower later Power value replaces a higher earlier value or whether VK effectively keeps a maximum/cumulative value.

If Current Power cannot decrease in the native leaderboard, implementation must stop and return to the owner for the approved decision gate.

## Next implementation action

1. Add an async request/response bridge layer behind the existing `platform` boundary using `request_id` correlation and timeout/error normalization.
2. Expose cloud-storage methods through `platform.storage.cloud` while preserving localStorage as the synchronous local cache.
3. Add deterministic mocked-VK coverage by extending the existing platform/Foundation regression where practical.
4. Only after real Storage limits are verified, freeze `CloudSaveV1` serialization/chunking.

## Real-VK checks still required

- [ ] Storage round-trip on VK Web.
- [ ] Storage current limits/error behavior.
- [ ] Rewarded availability/show result.
- [ ] Interstitial availability/show result.
- [ ] `apps.getLeaderboard` Global.
- [ ] `apps.getLeaderboard` Friends.
- [ ] Leaderboard lower-score/current-Power behavior.
- [ ] Repeat the platform-critical checks in VK Android/iOS before Mobile moderation submission.
