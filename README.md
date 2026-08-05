# RPChess

Fantasy tactical chess roguelite.

## Browser vertical slice

The production vertical slice is the root web entry:

- `/` — primary player-facing entry;
- `/vertical-slice.html` — isolated fallback entry for diagnostics;
- `/?help=1` — reopen the first-run play guide.

The slice includes three independent browser profiles, army selection, deployment, the Iron Marches campaign route, authored events, battles, rewards, all six Iron Marches hero abilities, their six bound relic mechanics and the two-phase Iron Regent boss.

Progress is stored automatically in browser local storage. The in-game `?` button opens the play guide again.

## Local verification

```bash
npm ci
npm test
npm run build
```

Serve the generated `dist/` directory with any static HTTP server and open its root page. Do not open the HTML through a `file://` URL because browser modules and local storage behavior differ there.

The live build is deployed automatically through Cloudflare Workers Builds from the `main` branch. The deployment URL is managed in the Cloudflare project settings for the `rpchess` Worker.
