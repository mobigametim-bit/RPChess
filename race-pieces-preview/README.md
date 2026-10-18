# RPChess acceptance preview

This directory contains the Cloudflare Worker configuration for the playable acceptance build of PR #160.

The exact commit message `deploy: race pieces preview` on this branch publishes the current game build to the existing acceptance Worker, running production build and targeted browser checks before deployment.

Latest QA focus: Training/Puzzle long RU/EN objective titles now scale and wrap within the panel instead of truncating, including compact landscape layouts. Advertising banner layout remains a separate HTML mockup pending owner approval; the live game has no new banner placement from this task.

Never merge PR #160 to `main` before owner manual acceptance.
