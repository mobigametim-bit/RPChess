# RPChess — VK Games moderation checklist

Updated: 2026-09-13

VK app: `54754579`

Current delivery path: `main` → canonical `dist/` → GitHub Pages → VK iframe/WebView.

Game URL: `https://mobigametim-bit.github.io/RPChess/`

The current VK developer dashboard and moderator feedback are authoritative if they differ from older project notes.

## Ready now

- [x] One canonical gameplay codebase; no VK gameplay fork.
- [x] Production build works from GitHub Pages over HTTPS.
- [x] VK Web opens the GitHub Pages game.
- [x] `VKWebAppInit` is sent at bootstrap in VK context.
- [x] Standalone Web startup remains available outside VK.
- [x] Shared platform boundary now covers VK/Web detection, storage and lifecycle.
- [x] Current v1 persistence is local storage behind the shared storage boundary.
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
- [ ] confirm no UI promises cloud sync unless cloud sync is implemented.

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
- [ ] Check Settings, RU/EN and SFX; current candidate intentionally has no background music.
- [ ] Check `844×390`-class landscape.
- [ ] Check normal desktop viewport.
- [ ] If Mobile is declared, repeat the critical smoke in the official VK mobile client.

## License/provenance gate

See `VK_LICENSE_AUDIT_2026-09-13.md`.

- [x] Stockfish notices/source handling documented.
- [x] Brahms font OFL/attribution documented.
- [x] Lichess puzzle source/license documented.
- [x] Remove the four Suno Free background-music tracks from the release candidate; no background music currently ships.
- [ ] Confirm provenance/commercial-use basis for `game/SFX/win_fanfare.mp3`.
- [ ] Record a concise provenance statement for original/generated production visual assets.
- [ ] Re-check the exact candidate for newly added third-party material.

Current repository-side audio blocker: `game/SFX/win_fanfare.mp3` provenance/commercial-use basis is still unresolved. Background music is no longer a blocker because none ships in the current candidate.

## Decisions still required from the project owner

- [ ] Cloud save in v1 or local-only save for first release.
- [ ] Monetization model for v1: rewarded/interstitial/purchases/none according to the current VK dashboard and product goals.
- [ ] Onboarding scope: guided tutorial, concise help/rules overlay, or current learn-by-play flow.
- [ ] Release scope: Web-only or Web + Mobile after real client testing.
- [ ] Final public title and age rating.
- [ ] Public support contact.
- [ ] Facts needed for Privacy Policy / Terms if required by the current form.
- [ ] Final card copy and marketing assets approval.

No cloud-save, ad or purchase feature should be added merely because an old project checklist mentioned it. Implement only the release scope we choose and that the current VK dashboard actually requires/supports.

## Submission gate

- [ ] exact candidate SHA recorded;
- [ ] candidate live on GitHub Pages;
- [ ] same candidate verified through VK;
- [ ] technical gate green;
- [ ] manual VK smoke green;
- [ ] provenance blockers resolved;
- [ ] required VK card/form fields complete;
- [ ] release scope and monetization choice confirmed;
- [ ] submit the candidate from VK dashboard.

## Safe to defer unless the current VK dashboard explicitly requires them

- cross-device cloud save;
- leaderboards;
- invites/share;
- purchases;
- rewarded/interstitial ads;
- deeper analytics.
