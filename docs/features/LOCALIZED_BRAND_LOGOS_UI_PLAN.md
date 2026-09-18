# Localized brand logos and UI polish — implementation plan

**Branch:** `feature/localized-brand-logos`  
**Status:** Implementation published for preview at commit `7c98cf416c58141b8c9aedbe333940ab866810fd`; visual/Cloudflare acceptance remains pending.  
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
- [x] Restore compact product-card frame heights and paddings in Settlement CSS while preserving the current large icon rendering.
- [x] Add source/localization coverage for logo switching, no legacy runtime wordmark and market-card geometry; responsive browser coverage remains part of the preview gate.
- [x] Publish the implementation commit to the isolated GitHub branch (commit `7c98cf416c58141b8c9aedbe333940ab866810fd`).
- [ ] Run the canonical local gate and visually inspect Russian/English at 1920×1080, 1024×768, 844×390 and mobile portrait.
- [ ] Confirm the Cloudflare Preview URL and obtain user acceptance; a branch preview must not change `main`.
- [ ] After acceptance, merge via PR, update this plan and Notion to complete, then manually run GitHub Pages for `main` to publish the existing VK URL.

## Asset and delivery notes

- The source `title_wordmark.png` is retained as an archival source file only unless a future product decision explicitly requests deletion. It will not remain in the runtime asset allowlist or visible UI.
- The Pages workflow is manual for production release. A branch preview never changes the VK version.
- GitHub and Notion checklists must be updated together after every meaningful milestone.
