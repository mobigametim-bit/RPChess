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
- [x] Events v1 — **100 событий / 415 решений**, 14 расовых групп + mixed, literary scene, role/economy/recruit/wound/death outcomes, 4 explicit King-risk choices, Event→Skirmish/Battle без второго Supply charge, race/mixed armies, black-side play, illustrated backgrounds, castling/promotion combat-art continuity. **IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DOCS SYNCED → DONE.**
- [x] Event background register — полный утверждённый набор **36 PNG** подключён напрямую: 8 generic + 14 race pools × 2; Animals/Fae/Goblins больше не используют fallback/альтернативные имена. Source verification и Events tests фиксируют этот контракт.
- [x] **PLAYTEST GATE C** — интересность собственного состава и corrected Skirmish flow подтверждены пользователем.

## Next

- [ ] Puzzles — FEN/solution engine и импорт задач. **CURRENT: UX/spec discussion, implementation not started.**
- [ ] Encounter Generator.
- [ ] Adaptive Skirmish Generator.
- [ ] Content Framework.
- [ ] First Complete Endless Run.
- [ ] Balance Gate.
- [ ] Region Content Framework.
- [ ] Tutorial Campaign — позднее.
- [ ] Metaprogression — только после подтверждения core loop.

## Current phase

**Events v1 — DONE, включая закрытый Event-background asset debt. Следующий этап: Puzzles UX/spec discussion. Реализация Puzzles не начинается до отдельного утверждения UX/spec пользователем.**

### Events final receipt

- Accepted gameplay head: `5347db734a82639f41188e74874ebee4a15540ea`.
- Accepted version: `3.0.0-events.preview.6`.
- Accepted Cloudflare build: `4c5013dc-7e28-41a4-aa01-8684a21c3f8d` — **SUCCESS**.
- Accepted Cloudflare Version: `56865d3e-18b0-4868-8329-5171cd016ec2`.
- Human confirmation: **«всё хорошо и все работает»** — 2026-08-29.
- Acceptance-docs head: `1b39988a4deeffb88edd379343b5f69ea86f82db`.
- Acceptance-docs Cloudflare build: `4bc864ec-93dc-4800-aa3f-c87ba8b2098c` — **SUCCESS**; Version `31dac392-6d39-4d85-9d56-26a8b218de3e`.
- Original Draft PR #76 was closed unmerged only because the connected Ready mutation failed on a GitHub GraphQL schema incompatibility; the identical exact tree was opened as non-Draft PR #77.
- PR #77 squash-merge / production `main`: `1e47a4a3121f1156a623a98ae29866b3a07d4cbc`.
- Post-merge Cloudflare build: `5f137e48-7b8a-42e1-830e-c7826fa8f11a` — **SUCCESS**; Version `45dcd46b-1306-4249-ae14-f48b5cd4b492`.

### Events accepted contract

- Travel playable pool: `Skirmish / Battle / Settlement / Event`; каждая из 3 карточек независимо выбирает тип с долгосрочной долей около 25%, дубликаты допустимы.
- Event route расходует обычный `1 Supply`; Event→Combat не списывает второй Supply.
- 100 Events / 415 authored choices; deterministic shuffle-bag без повторов до завершения цикла.
- Persistent/idempotent choice roll, economy and outcomes.
- Role-gated choices, recruit, wound/death, 4 explicit King-risk choices.
- Event combat uses 1–12 stars, race-specific/mixed armies and deterministic player side.
- Dedicated explicit Event backdrop `<img>`; desktop reading area оставляет открытую часть иллюстрации.
- Combat-art continuity сохраняет race/custom rook asset после рокировки.
- Неименная временная пешка при promotion получает art выбранной `queen / rook / bishop / knight` и сохраняет его после следующих ходов.
- Live scene transitions aftermath → Travel → Event подтверждены.
- Event background register: ровно 36 канонических active files; runtime pools, tests и source verification используют утверждённые имена.

### Event background register — CLOSED

Канонический набор состоит из 8 generic backgrounds и двух backgrounds для каждой из 14 рас. Animals используют `wild_glen.png` / `riverbank_tracks.png`; Fae — `fae_ring_garden.png` / `whispering_meadow.png`; Goblins — `goblin_trade_nook.png` / `goblin_scrapyard_camp.png`. Старые fallback/альтернативные имена выведены из active runtime. Дополнительные Merfolk assets могут храниться для будущего контента, но не входят в активные 36.

## Development rule

Feature lifecycle: `IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DOCS SYNCED → DONE`.

Следующая gameplay feature не начинается до merge/post-merge closure текущей feature; для Puzzles сначала отдельно утверждается UX/spec.

## Global UI invariant

Все production surfaces — **frameless CSS-only panels** с `--ui-panel-safe-*` / `.ui-panel-safe`; active Reboot UI не использует `ui_panel_frame.png` или `ui_panel_wide.png`. Синий `ui_button_primary.png` остаётся approved CTA asset.

## Gates

Канонический deploy gate — source verification + deterministic Node suite + production build (`npm run gate:local`) и Cloudflare exact-head SUCCESS. Standalone `gate:full` содержит real-Chromium regression; GitHub Actions используется как ручная диагностика, если hosted runner доступен.

## Legacy boundary

Iron Marches v1 сохранён в `archive/iron-marches-v1` на `035fb817a93f53047a1d20f7cdfc9093b0f7d611`. Reboot не загружает legacy runtime, но может повторно использовать утверждённые asset-library материалы, кроме запрещённых production panel-frame assets.
