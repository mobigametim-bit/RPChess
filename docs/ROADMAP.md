# RPChess Reboot Roadmap

## Completed

- [x] Reboot Foundation — production-ready visual shell. **DONE**.
- [x] Classic Chess — полный локальный классический шахматный runtime. **DONE**.
- [x] Chess AI — Stockfish 18 adapter, 12 уровней ≈400–2600 Elo. **DONE**.
- [x] Roster — персонализированный King и roster figures, persistent statuses. **DONE**.
- [x] Skirmish — ограниченный состав, adaptive enemy, personalized board art, King-death run end. **DONE**.
- [x] Battle — полный классический комплект + named slot replacement. **DONE**.
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
- [x] First Complete Endless Run — continuous persistent core loop and unified run summary. Пользователь подтвердил интегрированную текущую сборку 2026-08-31: **«всё работает»**. Reconciled accepted head `f29ab08c927f054288302e0c858b0c58d9f3ad15`; Cloudflare exact-head build `19fe6998-51ed-43ac-b7f3-f111017be943` — **SUCCESS**; PR #95 squash-merged в `main` как `1f0540e3239d1ab0bcba7cef0755ba768e067739`. Accepted head и production merge имеют один tree SHA `266e3f8683cd5b43f4a3fbf225339cc70617a092`; исторический PR #87 закрыт как superseded. **IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → RECONCILED → MERGED → DOCS SYNCED → DONE.**
- [x] Battle Mercenaries Economy — стандартные Battle fillers стали оплачиваемыми Наёмниками с Gold → Supplies fallback и persistent casualty debt. Human accepted 2026-08-31. Accepted head `f2c3c92b3636b593cca97c662be6b8c3f1a692c9`; Cloudflare build `d431ac63-54ec-4757-9be3-16aefc9d0cf4` — **SUCCESS**; PR #93 squash-merged как `33f602b4b8644a9c7612ba18033c4ad0e9ee5941`. **IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DOCS SYNCED → DONE.**
- [x] Player Identity + Chronicle — `КТО ТЫ, ВОИН?`, persistent `playerName`, Event narrative personalization, main-menu Chronicle и локальная история лучших походов. Слава: `floor(sqrt(week * power) / 10)`. Human accepted 2026-08-31. Accepted head `d2439ba16a98266e87f410272a38d42b9e8424b9`; Cloudflare build `8b81e946-4ce7-4435-97e8-ab7c6c0b28f9` — **SUCCESS**; Draft #96 закрыт unmerged из-за GraphQL `fullDatabaseId`; identical PR #97 squash-merged как `bf071a1a7d99964d848177969657767b380e5167`. **IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → MERGED → DOCS SYNCED → DONE.**
- [x] Hero Notes — 37 канонических character-notes: 36 HERO-01–36 + Хранитель Клятвы; presentation-layer captions в Отряде и Поселении, включая legacy saves. Human accepted 2026-08-31. Accepted head `985865c06032b4e731b8ef120049d0cfd49765b1`; Cloudflare build `42ba300a-3374-49dd-9392-d0f299d08fa5` — **SUCCESS**; Draft #98 закрыт unmerged из-за GraphQL `fullDatabaseId`; identical PR #99 squash-merged как `a6526bc77a0b39241a9b0db2bd5bc62d9a764167`. Accepted head и merge имеют tree SHA `424fe98cc78005c787679a6de676a7082278ca9b`; 0 asset files changed. **IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → MERGED → DOCS SYNCED → DONE.**
- [x] Events v5 Hero Choices — **SOURCE APPROVED → IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → MERGED → DOCS SYNCED → DONE.** 500/500 событий, 537 персональных вариантов, HERO-01–36; missing/wounded/dead герой остаётся видимым locked-choice с именем и authored `heroLine`. Human accepted 2026-08-31. Exact accepted head `4bdd002bf618f73077c74329cc2f16edd48667ac`; Cloudflare exact-head build `90b126d9-1b28-4e60-8919-9b5d565a3f26` — **SUCCESS**; Draft #100 закрыт unmerged для established workaround; identical PR #101 squash-merged как `350e04783e4c4370dc490ff0745207b7f1b2ba11`. Accepted head и production merge имеют одинаковый tree SHA `abe48127ce4a709a22ecfbc86142aefdff493188`; 0 asset files changed.
- [x] **PLAYTEST GATE C** — интересность собственного состава и corrected Skirmish flow подтверждены пользователем.

## Current

- [ ] **Balance Gate** — следующий этап проекта.

## Next

- [ ] Region Content Framework.
- [ ] Tutorial Campaign — позднее.
- [ ] Metaprogression — только после подтверждения core loop.

## Current phase

**Events v4 — DONE. Puzzles — DONE. Power / Threat — DONE. Content Framework — DONE. First Complete Endless Run — RECONCILED / HUMAN ACCEPTED / DONE. Battle Mercenaries Economy — HUMAN ACCEPTED / DONE. Player Identity + Chronicle — HUMAN ACCEPTED / DONE. Hero Notes — HUMAN ACCEPTED / DONE. Events v5 Hero Choices — HUMAN ACCEPTED / MERGED / DONE. Current phase: Balance Gate.**

### Events v5 Hero Choices — accepted contract 2026-08-31

Утверждённый `events_v5.md` добавляет **537** персональных вариантов к **500 / 500** событиям для HERO-01–HERO-36. В каждом событии есть 1–2 hero-choice. Если конкретного героя нет, он ранен или погиб, вариант не скрывается: игрок видит имя, статус блокировки и авторскую реплику `heroLine`, но не может выбрать вариант.

Новых Event-механик v5 не добавляет. Каждый hero-choice переиспользует `chance / cost / success / failure` существующего `sourceChoiceId` того же события. Abstract role-gated source choice заменяется персональным; обычный source choice остаётся рядом. Role/King-specific wound/death после персонализации нацелен именно на `requiredHeroId`; random non-King последствия остаются random non-King.

Acceptance receipt:
- source SHA-256 `82eef9b76ac7af36d53cf96c6567449cf5c9fec9d106fd514ca9e5e83c86a191`;
- Human acceptance: **«всё хорошо» — 2026-08-31**;
- exact accepted head `4bdd002bf618f73077c74329cc2f16edd48667ac`;
- Cloudflare exact-head build `90b126d9-1b28-4e60-8919-9b5d565a3f26` — **SUCCESS**;
- accepted preview `https://01ad647c-rpchess.mobigametim.workers.dev`;
- Draft PR #100 closed unmerged only for the established Draft→Ready workaround;
- identical non-Draft PR #101 squash-merged в `main` как `350e04783e4c4370dc490ff0745207b7f1b2ba11`;
- accepted head и production merge имеют одинаковый tree SHA `abe48127ce4a709a22ecfbc86142aefdff493188`;
- 12 changed files / **0 asset files**;
- GitHub Actions не использовались.

### Player Identity + Chronicle — accepted contract 2026-08-31

`Новая игра` больше не создаёт run немедленно. Сначала открывается prompt `КТО ТЫ, ВОИН?` → поле имени → `ПРОДОЛЖИТЬ`; после валидного ввода создаётся новый run и продолжается существующая последовательность сцен. Имя обязательно, trim применяется, пустое значение не принимается; reload активного run имя не теряет.

В Event narrative имя подставляется только там, где текст говорит о личности/герое игрока. Глобальный blind string replace запрещён: формулировка должна оставаться грамматически корректной. Шахматная фигура, шах/мат, технические статусы и системные сообщения продолжают использовать термин `Король / King`, когда речь именно о механике.

Летопись на главном экране — player/profile surface, а не economy HUD. Gold/Supplies в ней не показываются. Текущий поход показывает имя, профильную Мощь, текущую неделю и число героев. Лучший завершённый поход показывает имя, Славу, неделю и Мощь. Причина окончания не отображается.

Формула Славы: `floor(sqrt(week * power) / 10)`. По ней выбирается лучший поход. При равной Славе выигрывает большая неделя, затем большая Мощь. Архитектура Chronicle допускает будущую замену локального блока на multiplayer leaderboard / top players + позицию текущего игрока без переделки главного меню.

Acceptance receipt:
- Human acceptance: **«все хорошо» — 2026-08-31**;
- exact accepted head `d2439ba16a98266e87f410272a38d42b9e8424b9`;
- Cloudflare exact-head build `8b81e946-4ce7-4435-97e8-ab7c6c0b28f9` — **SUCCESS**;
- accepted preview `https://90254e9f-rpchess.mobigametim.workers.dev`;
- Draft #96 закрыт unmerged только из-за GraphQL `fullDatabaseId` при Draft → Ready;
- identical non-Draft PR #97 squash-merged в `main` как `bf071a1a7d99964d848177969657767b380e5167`;
- feature diff не содержал изменений assets;
- GitHub Actions не использовались.

### Battle Mercenaries Economy — accepted contract

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

Casualty debt разрешается после завершения именно этой Battle: погибает ровно **один named non-King hero**. Приоритет кандидатов: `wounded` → `healthy`; dead и King не участвуют; стоимость/тип героя на выбор не влияют. Среди равных кандидат выбирается детерминированно. Если run уже завершён terminal RPG-причиной, дополнительная casualty не применяется.

На подготовке нет отдельного warning/confirm. Один клик `Начать битву` запускает Battle. Уже на сцене доски существующий верхний toast показывает фактическое списание Gold/Supplies и, при debt, сообщает о будущей потере героя. Payment/debt persistent и idempotent.

Acceptance receipt:
- Human acceptance: **«всё хорошо» — 2026-08-31**;
- exact accepted head `f2c3c92b3636b593cca97c662be6b8c3f1a692c9`;
- Cloudflare exact-head build `d431ac63-54ec-4757-9be3-16aefc9d0cf4` — **SUCCESS**;
- Draft #92 закрыт unmerged только из-за GraphQL `fullDatabaseId` при Draft → Ready;
- identical non-Draft PR #93 squash-merged в `main` как `33f602b4b8644a9c7612ba18033c4ad0e9ee5941`;
- GitHub Actions не использовались.

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

Proposal о постоянной трёхветочной схеме `main / deploy / Legasy` и автоматической очистке остальных веток **отменён пользователем 2026-08-31**. Ветки пользователь почистит самостоятельно; branch-management не является частью текущего roadmap.

## Global UI invariant

Все production surfaces — **frameless CSS-only panels** с `--ui-panel-safe-*` / `.ui-panel-safe`; active Reboot UI не использует `ui_panel_frame.png` или `ui_panel_wide.png`. Синий `ui_button_primary.png` остаётся approved CTA asset.

## Gates

Канонический deploy gate — source verification + deterministic Node suite + production build (`npm run gate:local`) и Cloudflare exact-head SUCCESS. Standalone `gate:full` содержит real-Chromium regression. **GitHub Actions не используются.**

## Legacy boundary

Iron Marches v1 canonical archive SHA: `035fb817a93f53047a1d20f7cdfc9093b0f7d611`. Reboot не загружает legacy runtime, но может повторно использовать утверждённые asset-library материалы, кроме запрещённых production panel-frame assets. Branch naming/cleanup пользователь ведёт самостоятельно.