# Localized brand logos and UI polish — implementation plan

**Branch:** `feature/localized-brand-logos`  
**Status:** Implementation published for preview; latest UI-alignment commit `6e80f773295adb59636e9d5f59a98a36eb5c3f82`; visual/Cloudflare acceptance remains pending.  
**Scope:** localize the RPChess brand mark across the UI, remove the unnecessary main-menu tagline, and restore compact market-card framing while retaining the accepted larger artifact icons.

## Product contract

- Every visible runtime use of the legacy `title_wordmark.png` becomes a localized brand logo: `logo_ru.png` for Russian and `logo_en.png` for English.
- The active logo updates immediately when the language is changed; it does not require a reload.
- Both logos are runtime assets and must enter the existing copy/compression/cache contract.
- The main menu must not display the tagline **FANTASY TACTICAL CHESS ROGUELITE**.
- Settlement products retain the shared framed-card layout. Card frames return to the compact proportions of the accepted early artifact preview; supplies and artifact icons retain the current unified visible icon size.
- Existing visual contracts remain intact: no overlap, clipping or page-scroll regression at desktop, tablet, narrow landscape and mobile portrait sizes.

## Execution checklist

- [x] Verify that Artifacts MVP documentation is closed in GitHub and Notion.
- [x] Create this isolated feature branch and record the implementation plan.
- [x] Add canonical source assets `game/generated_assets/logo_ru.png` and `game/generated_assets/logo_en.png`.
- [x] Add both logos to `scripts/build.cjs` runtime asset list so `scripts/runtime-assets-build.cjs` compresses and caches them.
- [x] Update the runtime asset registry and source/asset-contract tests for both logos.
- [x] Introduce one shared locale-aware brand-logo resolver; avoid individual per-screen language branches.
- [x] Replace all visible static and dynamic `title_wordmark.png` usages with the resolver/data attribute contract; remove the hidden legacy reference.
- [x] Remove the main-menu tagline from markup/localization without leaving unused UI strings.
- [x] Align the main-menu logo to the action-column center and raise it above the buttons; keep centered fallback behavior at tablet and mobile widths.
- [x] Restore compact product-card frame heights and paddings in Settlement CSS while preserving the current large icon rendering.
- [x] Add source/localization coverage for logo switching, no legacy runtime wordmark and market-card geometry; responsive browser coverage remains part of the preview gate.
- [x] Publish the implementation to the isolated GitHub branch (latest commit `6e80f773295adb59636e9d5f59a98a36eb5c3f82`).
- [ ] Run the canonical local gate and visually inspect Russian/English at 1920×1080, 1024×768, 844×390 and mobile portrait.
- [ ] Confirm the Cloudflare Preview URL and obtain user acceptance; a branch preview must not change `main`.
- [ ] After acceptance, merge via PR, update this plan and Notion to complete, then manually run GitHub Pages for `main` to publish the existing VK URL.

## Preview evidence (partial)

- Cloudflare Preview `https://2b0af307-rpchess.mobigametim.workers.dev/`: main-menu brand logo was visually verified at the available 1363×936 desktop viewport in RU and EN. It remains centered over the action column, clears the first button, and switches immediately from `logo_ru.png` to `logo_en.png`.
- Compact Roster and Battle-preparation layouts intentionally hide their pre-existing header-logo slots through `ui-redesign-final.css`; they are not treated as visible logo screens in this acceptance pass.
- The full tablet / narrow-landscape / mobile-portrait viewport matrix is still open because this preview browser cannot resize its viewport.

## Asset and delivery notes

- The source `title_wordmark.png` is retained as an archival source file only unless a future product decision explicitly requests deletion. It will not remain in the runtime asset allowlist or visible UI.
- The Pages workflow is manual for production release. A branch preview never changes the VK version.
- GitHub and Notion checklists must be updated together after every meaningful milestone.
