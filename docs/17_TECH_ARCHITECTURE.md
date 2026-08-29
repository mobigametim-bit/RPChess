# 17 — Tech Architecture

## Целевое разделение
- `src/chess/` — rules, position, notation, AI, puzzles.
- `src/run/` — travel, encounters, generator, resources.
- `src/roster/` — characters, army, injuries.
- `src/content/` — characters, races, events, puzzles, settlements.
- `src/persistence/`, `src/ui/`, `assets/`.

## Критический контракт
Chess layer ничего не знает о gold, supplies, events или campaign. Он получает позицию/ход и возвращает legality, position, check, mate, draw.

## Разработка
Каждая feature проходит один и тот же lifecycle:

`ТЗ → DoD → feature branch → local gates → Cloudflare exact-head preview → human playtest → fixes → acceptance → GitHub docs + Notion → merge → production verification`.

### Обязательные локальные gates
GitHub Actions **не является обязательным merge/deploy gate**. С 2026-08-29 основной автоматизированный контроль выполняется вне Actions:

1. `npm ci --no-audit --no-fund`
2. `npm run gate:local`
   - source/static verification;
   - все deterministic Node tests Foundation → текущая feature;
   - production build в `dist/`.
3. Для full gameplay candidate установить Playwright/Chromium:
   - `npm install --no-save --package-lock=false --ignore-scripts playwright@1.54.2`
   - `npx playwright install chromium`
4. `npm run test:browser` или единый `npm run gate:full` после установленного Playwright.
   - standalone Node static server поднимает `dist/` на `127.0.0.1:4173`;
   - последовательно выполняется real-Chromium regression Foundation → Classic Chess → Roster → Skirmish → Battle → Travel → Resources → Settlement → Starvation → Events.

`npm run gate:full` является главным техническим acceptance gate перед corrected preview.

### Cloudflare
`wrangler.toml` использует `npm run gate:local` как build command. Поэтому Cloudflare exact-head deployment обязан повторно пройти source verification, deterministic tests и production build перед публикацией assets.

После успешного local full gate и Cloudflare deployment проверяется живой preview URL. Human acceptance выполняется только на preview того же gameplay candidate или на документированном последующем docs-only head.

### GitHub Actions
`.github/workflows/ci.yml` сохранён только как **manual diagnostic workflow** с `workflow_dispatch`. Push и pull request больше не запускают его автоматически и failure GitHub hosted runner не блокирует feature lifecycle.

При необходимости manual workflow повторяет тот же `gate:local + Playwright Chromium` contract, но его результат является дополнительным сигналом, а не обязательным доказательством готовности.

## Merge rule
Feature нельзя переводить в DONE только по локальным тестам. До merge обязательны:
- успешный full local/standalone Chromium gate;
- успешный Cloudflare exact-head deployment;
- живой пользовательский playtest, если feature требует Human Acceptance;
- синхронизация GitHub docs + Notion;
- merge и post-merge production verification.
