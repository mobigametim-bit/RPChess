# RPChess — VK Games moderation checklist

Updated: 2026-09-24

VK app: `54754579`

Current delivery path: `main` → canonical `dist/` → manually dispatched GitHub Pages deploy → VK iframe/WebView.

The owner reported repeat moderation submission on 2026-09-24; the outcome is not yet verified. VK Cloud Save and battle resume have been merged in PRs #145–147. Cross-device continuation succeeded once after manual repair of a checksum-corrupted remote; do not mark automatic recovery or the full device matrix as accepted.

Game URL: `https://mobigametim-bit.github.io/RPChess/`

The current VK developer dashboard and moderator feedback are authoritative if they differ from older project notes.

## Ready now

- [x] One canonical gameplay codebase; no VK gameplay fork.
- [x] Production build works from GitHub Pages over HTTPS.
- [x] VK Web opens the GitHub Pages game.
- [x] `VKWebAppInit` is sent at bootstrap in VK context.
- [x] Standalone Web startup remains available outside VK.
- [x] Shared platform boundary now covers VK/Web detection, storage and lifecycle.
- [x] VK uses verified chunked cloud saves with localStorage as a local cache; direct Pages remains local-only.
- [x] Audio is paused when the host page becomes inactive and restored on return.
- [x] RU/EN localization exists.
- [x] Stockfish, Brahms font and Lichess puzzle notices are present in repository/build handling.
- [x] Critical compact combat/run-end UI has viewport regression coverage.

## Candidate technical gate

Before submission, freeze an exact `main` SHA and verify that exact build:

- [ ] run `npm run gate:local`;
- [ ] run release-critical browser smoke;
- [ ] build canonical `dist/`;
- [ ] verify Pages deployed from the candidate SHA;
- [ ] launch through VK, not only direct Pages;
- [ ] confirm no fatal console/page errors;
- [ ] confirm Stockfish worker/WASM loads and moves;
- [ ] confirm hide/background pauses audio and return resumes normally;
- [ ] confirm save/reload preserves the current run on the same browser/WebView;
- [x] verify cloud sync only appears in VK context; direct Pages remains local-only.

## Manual VK smoke

- [ ] Main menu opens.
- [ ] New run starts.
- [ ] Existing run resumes after reload.
- [ ] Travel works.
- [ ] Complete one Skirmish.
- [ ] Complete one Battle.
- [ ] Open an Event and choose an option.
- [ ] Open/complete a Puzzle.
- [ ] Open Settlement and perform a normal action.
- [ ] Verify King-death/run-end flow.
- [ ] Check Settings, RU/EN, SFX and the commercially cleared background-music rotation after the blocked track is resolved.
- [ ] Check `844×390`-class landscape.
- [ ] Check normal desktop viewport.
- [ ] If Mobile is declared, repeat the critical smoke in the official VK mobile client.

## License/provenance gate

See `VK_LICENSE_AUDIT_2026-09-13.md`, `../../THIRD_PARTY_NOTICES.md`, `../../CREDITS.md` and `../ASSET_PROVENANCE.md`.

- [x] Stockfish notices/source handling documented.
- [x] Brahms font OFL/attribution documented.
- [x] Lichess puzzle source/license documented.
- [x] Remove the four Suno Free background-music tracks from the release candidate; no background music currently ships.
- [x] `game/SFX/win_fanfare.mp3` identified as `_MC5_` / `Short Brass Fanfare 1.wav` / Freesound 524849 / CC BY 4.0; attribution recorded.
- [x] Record titles, authors, source URLs, conversion notes and licenses for `epic_music1..4.mp3`.
- [ ] Remove/replace `game/music/epic_music3.mp3` or obtain a separate commercial license; its Freesound license is CC BY-NC 4.0.
- [x] Record a concise provenance statement for original/generated production visual assets.
- [ ] Re-check the exact candidate for newly added third-party material.

Current blocker: `epic_music3.mp3` cannot ship in a commercial/moderation candidate under CC BY-NC 4.0. The other three new tracks are CC BY 4.0 and have the required attribution recorded. Re-check the exact release candidate after resolving the blocked track.

## Decisions confirmed for the planned VK v1

- [x] Cloud save between devices is desired for VK users; local storage remains a standalone/fallback backend.
- [x] Main leaderboard metric should be the existing player `Power` rating.
- [x] Run result sharing should include achievements/statistics and the King's death reason.
- [x] Rewarded ad: double the gold reward from the just-completed Battle/Skirmish, once per encounter.
- [x] Rewarded ad: when a selected route cannot be paid because Supplies are insufficient and starvation is about to begin, offer +5 Supplies; successful reward also pays the current route from those Supplies.
- [x] Interstitial ad cadence: every 5th committed Travel-card choice, with rewarded ads taking priority and a 60-second no-interstitial cooldown after rewarded.
- [x] First-run onboarding: one dismissible contextual explanation per screen/type after the first New Game; no global “skip tutorial” control and no persistent `?` help button in v1.
- [x] Purchases deferred.
- [x] Release target for first moderation: VK Web. Mobile client support/testing is deferred to a later release rather than declared for v1.
- [x] RPChess is already present in the VK payout cabinet; payout/advertising configuration still needs final dashboard verification before live ads.

## Decisions / implementation details still to finalize

- [ ] Select the no-paid-service architecture for securely submitting `Power` to the native VK leaderboard. A service secret must not be shipped in GitHub Pages; prefer a free-tier serverless endpoint if VK provides no client-safe score-write path.
- [ ] Define compact cloud-save schema/version, conflict policy and the exact persistent domains to sync (active run, Power, Chronicle/meta progression, tutorial flags; device-local settings stay local).
- [ ] Confirm the exact VK ad methods/availability checks and dashboard settings before enabling production ads.
- [ ] Final public title and age rating.
- [ ] Public support contact.
- [ ] Facts needed for Privacy Policy / Terms if required by the current form.
- [ ] Final card copy and marketing assets approval.

## Submission gate

- [ ] exact candidate SHA recorded;
- [ ] candidate live on GitHub Pages;
- [ ] same candidate verified through VK;
- [ ] technical gate green;
- [ ] manual VK smoke green;
- [ ] provenance blockers resolved;
- [ ] required VK card/form fields complete;
- [ ] cloud save / sharing / leaderboard / ad implementation for chosen v1 scope complete and smoke-tested;
- [ ] submit the candidate from VK dashboard.

## Safe to defer for v1

- Mobile declaration/release;
- purchases;
- deeper analytics;
- share-card image generation (text/result sharing is sufficient for v1).
