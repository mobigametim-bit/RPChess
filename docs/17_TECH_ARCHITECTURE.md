# 17 — Tech Architecture

## Целевое разделение
- `src/chess/` — rules, position, notation, AI, puzzles.
- `src/run/` — travel, encounters, generator, resources.
- `src/roster/` — characters, army, injuries.
- `src/content/` — characters, races, events, puzzles, settlements.
- `src/persistence/`, `src/ui/`, `assets/`.

## Критический контракт
Chess layer ничего не знает о Gold, Supplies, Events или campaign. Он получает позицию/ход и возвращает legality, position, check, mate, draw.

## Канонический lifecycle разработки
Каждая player-facing feature проходит один и тот же lifecycle:

`ТЗ / DoD → feature branch → implementation → technical gates → visual/live review → Human Acceptance → docs sync → merge → production verification`

Зелёный CI сам по себе не заменяет Human Acceptance для UI/gameplay изменений.

## Тестирование и защита выпуска (утверждено 12.11.2026)

Единственный актуальный подробный контракт: [DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md).

- В ходе PR — `.github/workflows/pr-focused-checks.yml`: source/security/build minimum и выбор Node/real-Chromium регрессий по затронутым и сопряжённым модулям.
- После **прямой Human Acceptance** — label `release-approved` и обязательный `.github/workflows/release-gate.yml` → `npm run gate:full` с **36** уникальными default browser suites. До приёмки этот check блокирует merge.
- `.github/workflows/full-project-review.yml` — ручной аудит всех 36 suite с отчётом обо всех отказах; прежнее ограничение 17 suite отменено.
- `main` принимает только проверенный PR, production GitHub Pages выходит отдельно по явно разрешённому релизу.
- `.github/workflows/pages.yml` не выполняет полный Pages gate в каждом PR или в обычном push в `main`; release коммит или ручной запуск выполняет build + Pages subpath smoke и deployment.
- Нужна настройка branch protection на `main`: обязательные PR Focused Checks / Release Gate, up-to-date branch, запрет direct push/bypass. Это отдельный административный шаг.

Production URL: https://mobigametim-bit.github.io/RPChess/

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

Актуальный workflow contract описан в [DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md). Новые задачи используют `pr-focused-checks.yml` + `release-gate.yml`, production — `pages.yml`.

## Merge rule
До merge player-facing изменения должны иметь:

- минимально достаточные deterministic/build проверки;
- реальный browser check для затронутого responsive/runtime контракта, когда он необходим;
- Human Acceptance пользователя, если меняется видимый UI/gameplay;
- обновление применимых документов GitHub (`docs/`, `README.md`, PR) как единственного обязательного источника истины; Notion не требуется и не блокирует merge.

После merge production deploy выполняется только по отдельной команде владельца; успешность подтверждается GitHub Pages build + deploy jobs.
