# RPChess deployment contract

**Status:** ACTIVE  
**Owner decision:** 2026-09-16

## Canonical hosting

RPChess is hosted from GitHub Pages.

Canonical delivery path:

```text
main
  -> .github/workflows/pages.yml
  -> canonical dist/
  -> GitHub Pages
  -> https://mobigametim-bit.github.io/RPChess/
  -> VK iframe / WebView for app 54754579
```

VK Hosting is **not** part of the active release/test path. Do not deploy RPChess through `vk-miniapps-deploy`, `dist-vk`, or VK Hosting unless the owner explicitly changes the hosting strategy.

## Manual deployment rule

Deployment to GitHub Pages is intentionally manual.

1. Development changes are merged/finalized in `main`.
2. The owner opens GitHub Actions -> **Deploy RPChess to GitHub Pages**.
3. The owner selects `main` and presses **Run workflow**.
4. The workflow runs the canonical local gate, production build and browser checks.
5. Only a successful manual `workflow_dispatch` uploads and deploys `dist/` to GitHub Pages.
6. The test URL is always:
   `https://mobigametim-bit.github.io/RPChess/`

Pushes to `main` do **not** automatically deploy. Pull requests may run the build/test part, but never publish Pages.

## VK testing rule

For testing the same GitHub Pages candidate inside VK, the VK app Web/Mobile development URL(s) must point to:

`https://mobigametim-bit.github.io/RPChess/`

A previous diagnostic VK Hosting run may have replaced development URLs with a `stage-app...pages.vk-apps.ru` address. Such a URL is obsolete for the active architecture and must not be treated as the RPChess release candidate.

## Handoff rule for agents

When the owner asks for a test build:

- do not deploy to VK Hosting;
- do not invent a new preview hosting path;
- finish the intended changes in `main`;
- tell the owner to manually run **Deploy RPChess to GitHub Pages**;
- after the workflow succeeds, provide the canonical test URL:
  `https://mobigametim-bit.github.io/RPChess/`.
