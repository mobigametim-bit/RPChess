# Tournament server (work in progress)

This code is independent of leaderboard-worker. It is not the deployed leaderboard and must never overwrite it.

## Main components
- TournamentLobby: serialized queue and private invitation management.
- TournamentMatch: server-authoritative chess using the same pure ClassicChessEngine; 10+0 clocks, resign, draw, reconnect via snapshot.
- Worker: CORS, VK-signed session if VK_APP_SECRET is set, pseudonymous guest token otherwise.

## IMPORTANT
- Production deployment is not authorized until two-browser live testing passes.
- Requires Cloudflare Worker secret PVP_SESSION_SECRET (>= 32 random bytes encoded securely).
- Optional VK_APP_SECRET for validated VK identities. Without it, VK clients are guests.
- Reward/Power settlement and Arena shard syncing are NOT yet implemented.
- Do not expose secrets in game/index.html or JavaScript.
- No fake opponents or fake rewards. Never identify guest tokens as proof of ownership for Arena purchases.
- worker uses polling transport for first server validation; upgrade to WebSocket Hibernation before scaling.

## Dry-run
npm ci
npx wrangler deploy --config tournament-worker/wrangler.toml --dry-run

## Actual deploy (after credentials and signing secret are configured)
npx wrangler deploy --config tournament-worker/wrangler.toml

Use new_sqlite_classes for both Durable Object classes.
