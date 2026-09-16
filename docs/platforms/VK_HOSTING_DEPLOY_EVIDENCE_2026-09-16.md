# VK Hosting deploy evidence — 2026-09-16

## Scope

This note records the deployment investigation performed after the post-smoke correction candidate could build successfully but VK Hosting intermittently returned:

`Error: 15: Access denied: invalid file`

The canonical product/implementation plan remains `docs/platforms/VK_V1_SOCIAL_MONETIZATION_PLAN.md`.

## Candidate

Gameplay candidate before CI hardening:

- `cf3d304b0c62ed90f295cbf7b53b1a5775e14731`
- `test: match localized solo-king ending copy`

This candidate contains the post-smoke run-end/share, fanfare, Chronicle, Power-balance, new-run carryover and Training-glyph corrections.

## Findings

The failure is not reliably caused by an invalid RPChess file.

Evidence:

1. Standard VK deploy run `35095539712` built the candidate and passed `npm run gate:vk`, but the upload step returned `Error: 15: Access denied: invalid file`.
2. A previously successful known-good candidate (`740f86fd242c40a298c758ead98799289e723612`) was deployed again and succeeded, producing Hosting version `1789562970`.
3. The same known-good candidate was also deployed in a separate diagnostic run and received the same `invalid file` error, proving that the error can occur without any package-content change.
4. The current candidate was then deployed with bounded retries. Attempt 1 returned the same error; attempt 2 succeeded without rebuilding or changing `dist-vk`.

Conclusion: treat this VK Hosting response as a transient upload/backend failure unless a future failure becomes deterministic for the same package.

## Successful current-candidate deployment

Diagnostic run: `35098907277`

- `npm run gate:vk`: PASS
- deploy attempt 1: transient `Error: 15: Access denied: invalid file`
- deploy attempt 2: SUCCESS
- uploaded VK Hosting version: `1789563608`
- dev URL (desktop / iOS / Android / m.vk):
  `https://stage-app54754579-d691b51704a3.pages.vk-apps.ru/index.html`

The diagnostic branch adds only a workflow file; its game/build inputs are the `cf3d304b...` candidate.

## Permanent workflow hardening

`main` commit `a8c85b502abe7b85d60e4c883ec085b8dcc15113` changes only `.github/workflows/vk-deploy.yml`.

The manual VK deploy remains `workflow_dispatch` only. Its upload step now performs up to five bounded attempts with a 45-second delay between failures. Gameplay code and the VK build contract are unchanged.

## Remaining manual acceptance

The deployed candidate still needs owner smoke in real VK for the post-smoke correction set:

- Battle/Skirmish King-death ending reaches the canonical final summary and exposes Share;
- victory fanfare is audible in VK;
- Chronicle does not show `Новое имя ещё ждёт своей дороги.` with no active run;
- positive Power gain is halved for Skirmish wins and divided by three for Training wins;
- a new run begins at 75% of the preceding run's final Power;
- material Training objective displays the target chess-piece glyph rather than its written name.

Rewarded ×2 Gold was already confirmed on real VK Web Hosting version `1789552334` and is not an unresolved item from this correction set.
