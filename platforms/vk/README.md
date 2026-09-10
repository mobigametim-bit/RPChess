# RPChess — VK Games platform layer

**Status:** platform foundation only. VK Bridge, `app_id`, VK Hosting config and VK-specific build are intentionally not connected yet.

This directory documents the platform boundary for the first VK Games release. The shared game remains in `game/`; VK-specific integration must stay behind `game/js/platform/` and later VK build/config tooling.

## Rules

- Do not fork or copy gameplay modules for VK.
- Do not call `VKWebApp*` / `bridge.send(...)` directly from Battle, Skirmish, Events, Resources, Settlement, Puzzles or other gameplay owners.
- Shared gameplay/UI/localization/assets remain common for Web and VK.
- Platform-specific capabilities are exposed only through the platform adapter.
- The default production Web build must continue to resolve `web-platform.mjs` and behave as before.
- `vk-platform.mjs` is currently a safe scaffold with Bridge capabilities disabled. Stage 3 of `docs/platforms/VK_GAMES_PUBLICATION_PLAN.md` will connect `@vkontakte/vk-bridge` and early `VKWebAppInit`.
- `vk-hosting-config.json` is created only after the owner creates the VK game and provides `app_id`.

## Current adapter surface

`platform.init()` resolves one adapter and exposes service boundaries for:

- `storage`
- `ads`
- `payments`
- `analytics`
- `social`
- `lifecycle`

Unsupported services expose `supported: false`; future VK integrations should replace those service objects rather than bypassing the boundary.

## Source of truth

See `docs/platforms/VK_GAMES_PUBLICATION_PLAN.md`. Current project stage: **VK Games publication**.
