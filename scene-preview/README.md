# RPChess prepared-scene preview

Temporary game preview on Cloudflare Workers static assets, built from branch
`feature/scene-preload-transitions-20261016`.

Preview URL (after a successful GitHub Actions deployment):
https://rpchess-scene-preview.mobigametim.workers.dev/

## Manual acceptance

- Open a journey in a fresh/private browser session and watch the route cards.
- Choose Skirmish, Battle or Caravan, then enter combat.
- The previous completed screen should remain visible until the next scene's assets are ready; longer loads show "Подготовка…" or "Preparing…".
- No generic chess sprite should be visibly replaced by a hero/race-specific image after the board appears.
- Verify route/army/artifact behavior, reload or resume during the journey, mobile landscape and RU/EN.
- If any image fails to load, the transition completes after a bounded timeout rather than freezing.

This preview does not replace GitHub Pages, the VK application, or the API Worker.
A direct preview tab is not equivalent to a signed VK Mini Apps launch.

## Regression fix

The final scene reveal re-renders localized headings and labels in the then-current language before removing the prior scene. This covers language changes while images are still loading.

## Full-screen loading cover (2026-10-16)

Until the destination scene is painted and its visible art decoded, show a full-screen **black** cover with the current RU/EN game's logo and blinking **ЗАГРУЗКА... / LOADING...**. This includes Travel card images, Skirmish/Battle/Caravan board art, and Arena combat art. Enforce a single seven-second safety budget in case a remote image is broken or a device is offline. After the destination scene becomes visible under the cover, trigger the responsive-layout owner event `rpchess:scene-revealed` and decode final visible images before dismissing the cover. Tests must pass before merging into main.
