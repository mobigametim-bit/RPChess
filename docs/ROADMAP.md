# RPChess Reboot Roadmap

- [x] Концепция Reboot утверждена.
- [x] Legacy branch создан до изменения gameplay.
- [x] Reboot Foundation — production-ready visual shell без старых gameplay-систем. Human accepted 2026-08-26; production-menu и audio corrections included.
- [x] Classic Chess — полный локальный классический шахматный runtime. **IMPLEMENTED → ENGINE-AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DONE.** Пользователь успешно прошёл полный gameplay/UX playtest и финальный scene-switch spot-check. Исправлен exclusive scene visibility contract. Canonical perft: start d3 = 8902; Kiwipete d1/d2/d3 = 48/2039/97862; canonical endgame d3 = 2812.
- [x] Chess AI — Stockfish adapter и уровни Elo. **IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DONE.** Stockfish 18 lite single-threaded работает через отдельный Web Worker/WASM adapter; 12 уровней ≈400–2600 Elo. Пользователь подтвердил AI gameplay, SAN/figurines, captured material и плавные ходы.
- [x] Roster — персонализированный король и фигуры. **IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DONE.** Отдельная сцена `Отряд`: detail + каталог, обязательный Хранитель Клятвы, 6 стартовых персонализированных фигур, классическая стоимость 1/3/3/5/9/0, статусы healthy/wounded/dead, memorial `Погибшие`, локальный persistent run и рабочая кнопка `Продолжить`. Пользователь принял исправленный preview 2026-08-27. Game-wide frameless panel standard остаётся обязательным для всех следующих feature.
- [ ] Skirmish — ≤16 фигур, ≤39 очков, adaptive enemy. **IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED pending.** UX утверждён; первый живой тест подтвердил основной flow. По итогам теста исправлены два пункта: обычный aftermath больше не показывает `Погибли`, а персонализированные фигуры используют собственный `pieceArt` непосредственно на доске и в move/capture presentation. Мат игроку ведёт в отдельный run-end summary `КОРОЛЬ ПОГИБ`.
- [ ] **PLAYTEST GATE C: короткий повторный тест исправленного Skirmish preview + подтверждение интересности собственного состава.**
- [ ] Battle — полный классический комплект + временные фигуры.
- [ ] Travel Choice — три случайных следующих пути после каждой встречи.
- [ ] Resources — Gold + Supplies.
- [ ] Settlement — лечение, найм, снабжение.
- [ ] Starvation — случайная смерть фигуры при переходе без припасов.
- [ ] Events — первый пакет 20–30 мгновенных событий.
- [ ] Puzzles — FEN/solution engine и импорт задач.
- [ ] Encounter Generator.
- [ ] Adaptive Skirmish Generator.
- [ ] Content Framework.
- [ ] First Complete Endless Run.
- [ ] Balance Gate.
- [ ] Region Content Framework.
- [ ] Tutorial Campaign — позднее.
- [ ] Metaprogression — только после подтверждения core loop.

## Current phase
**Skirmish — IMPLEMENTED / AUTOTESTED / DEPLOYED; corrected HUMAN RETEST pending.** Battle не начинается и Skirmish не merge-ится до явного human acceptance исправленного preview.

Accepted Roster gameplay head: `21486014ca110062fdcb776d5119b23dbe3418cf`.
Accepted Roster version: `2.3.0-roster.preview.3`.
Accepted Roster preview: `https://78461dc1-rpchess.mobigametim.workers.dev`.

Skirmish corrected gameplay head: `b11f712e63366a70f35c0de8fd0b823159dad0cd`.
Skirmish corrected version: `2.4.0-skirmish.preview.2`.
Skirmish gameplay CI: `33068231777` — **SUCCESS** including real Chromium.
Skirmish Cloudflare gameplay build: `d357a056-1850-407d-9421-76b151c062e8` — **SUCCESS**; Version `e8815edb-0617-43de-8449-f7f09cbbcea8`.
Skirmish gameplay preview: `https://e8815edb-rpchess.mobigametim.workers.dev`.

## Статусы feature
`IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DONE`

## Правило разработки
После каждой feature создаётся deploy preview. Следующая feature не начинается, пока пользователь не проведёт живой playtest там, где feature требует human acceptance.

## Global UI invariant
Все текущие и будущие production surfaces являются **frameless CSS-only panels**. Активный Reboot UI не использует `ui_panel_frame.png` или `ui_panel_wide.png`. Панели используют общий `--ui-panel-*` visual contract и `--ui-panel-safe-*` / `.ui-panel-safe` safe-area contract. Контент не касается внешней границы; левый внутренний отступ немного больше правого. Синий `ui_button_primary.png` остаётся approved CTA asset.

## CI note
Каждый merge gate требует source/static/engine/adapter/persistence tests, build/distribution boundary, real Chromium acceptance и Cloudflare SUCCESS на exact gameplay head. Static verification отдельно запрещает возврат ornate panel-frame assets в active Reboot CSS.

## Legacy boundary
Iron Marches v1 сохранён в `archive/iron-marches-v1` на `035fb817a93f53047a1d20f7cdfc9093b0f7d611`. Reboot не загружает старый runtime, но разрешено повторно использовать утверждённые визуальные ассеты из repository asset library, кроме запрещённых production panel-frame assets.