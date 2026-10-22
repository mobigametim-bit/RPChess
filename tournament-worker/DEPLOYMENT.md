# Tournament server staging deployment

1. In GitHub Repository Settings -> Secrets and variables -> Actions -> Repository secrets, keep existing CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID.
2. Create additional secret PVP_SESSION_SECRET with 40+ cryptographically random characters. Do not disclose it in chat, docs or game JavaScript.
3. GitHub Actions -> Deploy Tournament PvP Staging API -> Run workflow -> branch feature/tournament-pvp-mvp-20261022.
4. Read the actual Worker URL from job output. Verify /health before configuring a public frontend.
5. Set VK_APP_SECRET separately in this PvP Worker secrets to verify VK identities. Without it, VK launches are guest identities.
6. Test with two devices/browsers. Ranked rewards are still disabled.

Uses SQLite-backed Durable Objects. Does not modify leaderboard Worker/D1.
