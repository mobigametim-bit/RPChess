# RPChess Reboot Roadmap

## Completed

- [x] Reboot Foundation — production-ready visual shell. **DONE**.
- [x] Classic Chess — полный локальный классический шахматный runtime. **DONE**.
- [x] Chess AI — Stockfish 18 adapter, 12 уровней ≈400–2600 Elo. **DONE**.
- [x] Roster — персонализированный King и roster figures, persistent statuses. **DONE**.
- [x] Skirmish — ограниченный состав, adaptive enemy, personalized board art, King-death run end. **DONE**.
- [x] Battle — полный классический комплект + временные фигуры + named slot replacement. **DONE**.
- [x] Travel Choice — 3 persistent deterministic route cards, committed routing. **DONE**.
- [x] Resources — Gold + Supplies, idempotent combat rewards. **DONE**.
- [x] Settlement — лечение, найм, Supply shop. **DONE**.
- [x] Starvation — deterministic casualty при переходе без припасов. **DONE**; production merge `028e00c44f8e97586b0e5b39c2762ddf2c371835`, post-merge Cloudflare SUCCESS.
- [x] Events — active runtime **500 событий / 2114 решений**; historical Events v1 contract сохранён, Events v4 E101…E500 принят пользователем и merged. **IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DOCS SYNCED → DONE.**
- [x] Event background register — полный утверждённый набор **36 PNG** подключён напрямую: 8 generic + 14 race pools × 2; Animals/Fae/Goblins больше не используют fallback/альтернативные имена. Source verification и Events tests фиксируют этот контракт.
- [x] Puzzles v1 — fifth Travel type, Lichess CC0 offline catalog, mate1/2/3 + explicit material targets, 3 attempts, ★1…★12, Gold accuracy rewards, persistent resume/no-repeat, standard-piece board with coordinates/glyphs. **IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DOCS SYNCED → DONE.**
- [x] Encounter Generator — persistent Power / Threat + adaptive ★ for Skirmish/Battle/Puzzle. **DONE**.
- [x] Adaptive Skirmish Generator — **NO CHANGE REQUIRED / CURRENT BEHAVIOR ACCEPTED** after UX review.
- [x] Content Framework — central `ContentRegistry` + strict content validation. **DONE**.
- [x] First Complete Endless Run — continuous persistent core loop and unified run summary. Пользователь закрыл feature 2026-08-31. **IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DONE.** Historical PR #87 сохраняется только до безопасного переноса его feature-кода в новую branch-схему.
- [x] **PLAYTEST GATE C** — интересность собственного состава и corrected Skirmish flow подтверждены пользователем.

## Current

- [ ] **Battle Mercenaries Economy** — **UX/SPEC APPROVED → IMPLEMENTATION NEXT**.

### Battle Mercenaries Economy — approved contract

Стандартные неименные фигуры, которыми Battle добирает полный классический состав, называются **Наёмники**.

Стоимость Наёмников при нажатии `Начать битву`:
- Pawn — **1 Gold**;
- Knight — **3 Gold**;
- Bishop — **3 Gold**;
- Rook — **5 Gold**;
- Queen — **9 Gold**;
- King в системе Наёмников не участвует.

Оплата выполняется автоматически и атомарно в момент `Начать битву`:
1. сначала списывается доступное Gold;
2. недостающая стоимость покрывается Supplies по курсу **1 Supply = 10 Gold**, целыми единицами с округлением вверх;
3. если Gold + Supplies всё равно недостаточно, списываются все доступные ресурсы и фиксируется **один casualty debt** независимо от размера остатка.

Casualty debt разрешается после завершения именно этой Battle: погибает ровно **один named non-King hero**. Приоритет кандидатов: `wounded` (тяжело раненые) → `healthy`; dead и King не участвуют; стоимость/тип героя на выбор не влияют. Среди равных кандидат выбирается детерминированно. Если King погиб непосредственно в Battle и run уже завершён, дополнительная casualty не применяется.

На подготовке нет отдельного warning/confirm. Один клик `Начать битву` запускает Battle. Уже на сцене доски существующий верхний toast показывает фактическое списание Gold/Supplies и, при debt, сообщает о будущей потере героя. Payment/debt должны быть persistent и idempotent, чтобы reload не позволял избежать оплаты или casualty.

## Next

- [ ] Balance Gate.
- [ ] Region Content Framework.
- [ ] Tutorial Campaign — позднее.
- [ ] Metaprogression — только после подтверждения core loop.

## Current phase

**Events v4 — DONE. Puzzles — DONE. Power / Threat — DONE. Content Framework — DONE. First Complete Endless Run — HUMAN ACCEPTED / DONE. Current phase: Battle Mercenaries Economy — UX/SPEC APPROVED / IMPLEMENTATION NEXT.**

Следующая gameplay implementation — Battle Mercenaries Economy; после её human acceptance и closure проект переходит к Balance Gate.

### Puzzles final receipt

- Human acceptance: **«всё хорошо»** — 2026-08-29.
- Accepted gameplay head: `393fa3e6c4dda08186de75a8ae22d6aa442c0957`.
- Accepted version: `3.1.0-puzzles.preview.2`.
- Accepted-head Cloudflare build: `0942b70f-e0e7-47d0-86c9-2572917cf5de` — **SUCCESS**.
- Accepted preview: `https://f074203e-rpchess.mobigametim.workers.dev`.
- Original Draft PR #80 closed unmerged only because the connected Ready mutation failed on GitHub GraphQL `fullDatabaseId`; identical exact tree opened as non-Draft PR #81.
- PR #81 squash-merge / production `main`: `9aec0e12d3299656fb3c062b07c592e1d8332aab`.
- Final live-fix contract: Puzzle board coordinates + technical glyphs; persistent no-repeat history with `lastPuzzle` migration; Event→Skirmish enemy generation capped at 8 pawns with broad deterministic seed regression.

### Puzzles accepted contract

- Travel pool: `Skirmish / Battle / Settlement / Event / Puzzle`, ≈20% each per independent card roll; duplicates allowed.
- Puzzle route расходует обычный `1 Supply`; reload/resume не списывает второй Supply.
- Types: mate in 1 / mate in 2 / mate in 3 / explicit target-piece material.
- Difficulty: ★1…★12; active runtime derives base stars from current player Power and applies deterministic route variance. Raw Lichess rating is internal metadata only.
- 3 attempts; wrong move does not advance the position.
- Gold: `9 + 3 × stars`, accuracy multiplier 100/70/40/0%.
- Hint mechanic intentionally excluded from v1.
- Standard white/black art, with orientation-aware coordinates and technical chess glyph per occupied square.
- Persistent solution state, idempotent reward settlement and persistent no-repeat Puzzle history.
- Lichess Open Database Puzzles / CC0 is the production source; runtime is offline and source-agnostic.

### Events final receipt

- Historical Events v1 accepted gameplay head: `5347db734a82639f41188e74874ebee4a15540ea`.
- Events v4 production catalog expansion: E101…E500; active total **500 / 2114**; accepted 2026-08-31.
- Events v4 production merge: `8ce9e09b30a23115a2a4660772881b912d4651ef`.
- Post-Events accepted UX merge: `f70e0a24ab5ec5ad0a0ff7ce29100484bf5b80ad`.
- GitHub Actions were not used for the current project workflow.

### Events accepted contract

- Current journey pool: `Skirmish / Battle / Settlement / Event / Puzzle`, ≈20% each; duplicates allowed.
- Event route расходует обычный `1 Supply`; Event→Combat не списывает второй Supply.
- 500 Events / 2114 authored choices; deterministic shuffle-bag без повторов до завершения цикла.
- Persistent/idempotent choice roll, economy and outcomes.
- Role-gated choices, recruit, wound/death, historical 4 explicit King-risk choices.
- Event combat uses 1–12 stars, race-specific/mixed armies and deterministic player side.
- Dedicated explicit Event backdrop `<img>`; desktop reading area оставляет открытую часть иллюстрации.
- Combat-art continuity сохраняет race/custom rook asset после рокировки.
- Неименная временная пешка при promotion получает art выбранной `queen / rook / bishop / knight` и сохраняет его после следующих ходов.
- Event background register: ровно 36 канонических active files; runtime pools, tests и source verification используют утверждённые имена.

## Development rule

Feature lifecycle: `UX/SPEC APPROVED → IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DOCS SYNCED → DONE`.

Новая постоянная branch-схема:
- `main` — только текущая подтверждённая версия игры;
- `deploy` — единственная рабочая ветка для разработки следующей feature и Cloudflare preview;
- `Legasy` — неизменяемый архив Iron Marches / Version 1.

После human acceptance feature из `deploy` переносится в `main`, затем `deploy` синхронизируется с новым `main`. Дополнительные feature/fix/tmp/archive branches не являются частью постоянной схемы и должны удаляться после безопасного переноса нужной истории.

## Global UI invariant

Все production surfaces — **frameless CSS-only panels** с `--ui-panel-safe-*` / `.ui-panel-safe`; active Reboot UI не использует `ui_panel_frame.png` или `ui_panel_wide.png`. Синий `ui_button_primary.png` остаётся approved CTA asset.

## Gates

Канонический deploy gate — source verification + deterministic Node suite + production build (`npm run gate:local`) и Cloudflare exact-head SUCCESS. Standalone `gate:full` содержит real-Chromium regression. **GitHub Actions не используются.**

## Legacy boundary

Iron Marches v1 canonical archive SHA: `035fb817a93f53047a1d20f7cdfc9093b0f7d611`. После branch cleanup этот exact commit хранится в постоянной ветке `Legasy`. Reboot не загружает legacy runtime, но может повторно использовать утверждённые asset-library материалы, кроме запрещённых production panel-frame assets.
