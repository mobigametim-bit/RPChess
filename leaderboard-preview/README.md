# Great Commanders playable test stand

Static assets for RPChess are published from the PR branch to a **separate** Cloudflare Worker, `rpchess-leaderboard-preview`, via `.github/workflows/leaderboard-game-preview.yml`.

- Published game preview is independent of the existing production GitHub Pages, VK app and the deleted old static `rpchess` Worker.
- The game uses the real leaderboard API URL from `game/index.html`.
- Opening the preview outside VK permits public top-ten viewing but does **not** authorize a personal rank or score submission; those require signed VK launch parameters.
- Never fabricate VK signed launch parameters or insert demo scores into the production D1.
- Remove the preview Worker once the feature has been manually accepted and deployed to the production platform.
