# 17 — Tech Architecture

## Целевое разделение
- `src/chess/` — rules, position, notation, AI, puzzles.
- `src/run/` — travel, encounters, generator, resources.
- `src/roster/` — characters, army, injuries.
- `src/content/` — characters, races, events, puzzles, settlements.
- `src/persistence/`, `src/ui/`, `assets/`.

## Критический контракт
Chess layer ничего не знает о Gold, Supplies, Events или campaign. Он получает позицию/ход и возвращает legality, position, check, mate, draw.

## Multi-platform delivery boundary
RPChess сохраняет **один общий gameplay/runtime**. Web, VK Games и будущие Android/iOS/Windows варианты не являются отдельными копиями игры и не должны иметь собственные форки Battle, Events, Resources, Settlement, Puzzles, Roster или другой domain logic.

Активная platform boundary находится в `game/js/platform/`:

- `platform.mjs` — resolver/runtime contract;
- `web-platform.mjs` — default Web adapter;
- `vk-platform.mjs` — VK Games adapter/scaffold;
- будущие platform implementations добавляются по той же модели, не через копирование gameplay owners.

Общий adapter contract предоставляет `init` и capability/service boundaries для `storage`, `ads`, `payments`, `analytics`, `social`, `lifecycle`. Неподдерживаемая capability обязана иметь безопасное состояние `supported: false`/fallback.

**Запрещено:** вызывать `VKWebApp*`, `bridge.send(...)` или SDK другой площадки напрямую из gameplay owner-модулей. Платформенный SDK подключается только внутри соответствующего adapter/build layer.

Foundation поднимает platform runtime неблокирующе. Web является default, поэтому появление VK integration не должно менять поведение канонической GitHub Pages сборки. VK Bridge, `VKWebAppInit`, `build:vk` и VK Hosting подключаются по `docs/platforms/VK_GAMES_PUBLICATION_PLAN.md`; текущий рабочий branch — `platform/vk-games`.

## Канонический lifecycle разработки
Каждая player-facing feature проходит один и тот же lifecycle:

`ТЗ / DoD → feature branch → implementation → technical gates → visual/live review → Human Acceptance → docs sync → merge → production verification`

Зелёный CI сам по себе не заменяет Human Acceptance для UI/gameplay изменений.

## Локальные technical gates
Минимально достаточный автоматизированный контракт:

1. `npm ci --no-audit --no-fund`
2. `npm run gate:local`
   - source/static verification;
   - deterministic Node regressions;
   - content/puzzle validation;
   - production build в `dist/`;
   - runtime asset optimization/budget checks.
3. Для полного browser gate устанавливаются Playwright/Chromium и выполняется `npm run test:browser` либо соответствующий scoped browser contract.

Постоянный `.github/workflows/full-project-review.yml` запускается вручную для milestone/release validation и выполняет все 17 Chromium-контрактов. Pages workflow сохраняет минимальный обязательный smoke subset.

Browser runner поднимает production `dist/` через standalone static server и проверяет реальный Chromium, а не dev DOM approximation.

## GitHub Pages — canonical production delivery

Публичный production RPChess размещён на GitHub Pages:

`https://mobigametim-bit.github.io/RPChess/`

Канонический workflow: `.github/workflows/pages.yml`.

### Pull request run
На каждом PR workflow:

1. checkout;
2. Node 22 + npm cache/runtime-asset cache;
3. `npm ci --no-audit --no-fund`;
4. `npm run gate:local`;
5. проверка размера `dist` — Pages artifact должен оставаться < 1 GB;
6. установка Playwright + Chromium;
7. real-Chromium verification production build под реальным project prefix `/RPChess/`;
8. **без deploy**.

Таким образом PR доказывает, что кандидат собирается и работает в тех же subpath-условиях, в которых будет опубликован.

### Push to main
Push в `main` повторяет тот же build/browser gate. Только после успеха:

- `dist/` загружается как Pages artifact;
- job `deploy` публикует его в environment `github-pages`.

Post-merge production verification считается закрытым только после зелёных build **и** deploy jobs на SHA нового `main`.

## Runtime asset pipeline
High-resolution source/master assets могут оставаться в `game/`, но production `dist/` проходит runtime optimization/budget pipelines. На текущем production state ими покрыты, среди прочего:

- race/hero/generic board pieces;
- portraits;
- backgrounds;
- race board skins;
- pin/ice VFX;
- combat auras;
- dedicated resource icons (включая Supplies).

Build fails closed, если покрытый runtime asset не удовлетворяет своему production budget после оптимизации.

## Cloudflare
`wrangler.toml` и команда `npm run deploy:cloudflare` сохранены только для явного ручного запуска владельцем.

Cloudflare **не является текущим canonical public production host**. Актуальный production contract — GitHub Pages workflow выше.

Автоматический Cloudflare deploy из push, PR или milestone gate запрещён.

## Presentation and lifecycle ownership

- Dynamic UI локализуется owner-ом при render через semantic keys/parameters; whole-document localization observer запрещён.
- Combat/Puzzle completion передаётся semantic lifecycle events. Broad `rpchess:run-updated` не используется для state mutation или completion fan-out.
- Screen owner создаёт и размещает собственный DOM/CSS; post-render reparenting и compatibility patch chains запрещены.

## GitHub Actions
GitHub Actions снова является частью активного delivery contract через `.github/workflows/pages.yml`:

- PR: canonical build + Pages/subpath Chromium validation;
- `main`: тот же gate + deploy.

Отдельные diagnostic/manual workflows могут существовать дополнительно, но не заменяют canonical Pages workflow.

## Merge rule
До merge player-facing изменения должны иметь:

- минимально достаточные deterministic/build проверки;
- реальный browser check для затронутого responsive/runtime контракта, когда он необходим;
- Human Acceptance пользователя, если меняется видимый UI/gameplay;
- синхронизацию GitHub docs + Notion.

После merge обязателен успешный GitHub Pages production run на новом `main`.
