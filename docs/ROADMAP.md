# RPChess Reboot Roadmap

- [x] Концепция Reboot утверждена.
- [x] Legacy branch создан до изменения gameplay.
- [x] Reboot Foundation — production-ready visual shell без старых gameplay-систем. Human accepted 2026-08-26; production-menu и audio corrections included.
- [x] Classic Chess — полный локальный классический шахматный runtime. **IMPLEMENTED → ENGINE-AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DONE.** Пользователь успешно прошёл полный gameplay/UX playtest и финальный scene-switch spot-check. Исправлен exclusive scene visibility contract. Canonical perft: start d3 = 8902; Kiwipete d1/d2/d3 = 48/2039/97862; canonical endgame d3 = 2812.
- [x] Chess AI — Stockfish adapter и уровни Elo. **IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DONE.** Stockfish 18 lite single-threaded работает через отдельный Web Worker/WASM adapter; 12 уровней ≈400–2600 Elo. Пользователь подтвердил AI gameplay, SAN/figurines, captured material и плавные ходы.
- [x] Roster — персонализированный король и фигуры. **IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DONE.** Отдельная сцена `Отряд`: detail + каталог, обязательный Хранитель Клятвы, 6 стартовых персонализированных фигур, классическая стоимость 1/3/3/5/9/0, статусы healthy/wounded/dead, memorial `Погибшие`, локальный persistent run и рабочая кнопка `Продолжить`. Пользователь принял исправленный preview 2026-08-27. Game-wide frameless panel standard остаётся обязательным для всех следующих feature.
- [x] Skirmish — ≤16 фигур, ≤39 очков, adaptive enemy. **IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DONE.** Пользователь принял corrected preview 2026-08-27. Персонализированные фигуры используют собственный `pieceArt` непосредственно на доске, обычный aftermath показывает только выживших/тяжело раненых, а мат игроку открывает отдельный run-end summary `КОРОЛЬ ПОГИБ`.
- [x] **PLAYTEST GATE C: интересность собственного состава и corrected Skirmish flow подтверждены пользователем.**
- [x] Battle — полный классический комплект + временные фигуры. **IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DONE.** Пользователь принял Battle preview 2026-08-27. Стандартная армия всегда 16 фигур / 39 очков + King 0; HEALTHY named-фигуры заменяют standard slots своего типа, generic slots остаются временными, персональная identity сохраняется на доске, а captured named non-King получают `wounded`.
- [ ] Travel Choice — три случайных следующих пути после каждой встречи. **IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED pending.** Ровно 3 persistent deterministic cards; card click сразу фиксирует необратимый выбор и запускает encounter; Roster/reload не перегенерируют развилку; текущий playable pool — Skirmish + Battle; aftermath возвращает в следующую тройку через `Продолжить путь`.
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
**Travel Choice — IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED pending.** Текущий gate — живой playtest Travel Choice preview. **Resources не начинается и Travel Choice не merge-ится до явного подтверждения пользователя.**

Current `main` before Travel Choice: `6a5f4b7cc2c920afc1309a876a5a44c43eac1b06`.

Travel Choice gameplay head: `d76fca5ad5e02260a836400c7398158c1657a6f6`.
Travel Choice version: `2.6.0-travel-choice.preview.1`.
Travel Choice gameplay CI: `33080571104` / #898 — **SUCCESS**, включая full real Chromium regression-suite Foundation → Classic Chess → Stockfish → Roster → Skirmish → Battle → Travel Choice.
Travel Choice gameplay Cloudflare build: `0550b45c-ca7c-4104-8907-fafc2dda0b13` — **SUCCESS**; Version `48116a6f-9290-4108-8166-0b9ab5d4cb7c`.
Travel Choice gameplay preview: `https://48116a6f-rpchess.mobigametim.workers.dev`.
Travel Choice branch alias: `https://feature-travel-choice-rpchess.mobigametim.workers.dev`.

Accepted Roster gameplay head: `21486014ca110062fdcb776d5119b23dbe3418cf`.
Accepted Roster version: `2.3.0-roster.preview.3`.
Accepted Roster preview: `https://78461dc1-rpchess.mobigametim.workers.dev`.

Accepted Skirmish corrected gameplay head: `b11f712e63366a70f35c0de8fd0b823159dad0cd`.
Accepted Skirmish docs-synchronized head: `40b093eeb601097afe9fa0da0990594a8fcc2ffc`.
Accepted Skirmish version: `2.4.0-skirmish.preview.2`.
Accepted Skirmish push CI: `33068848497` / #882 — **SUCCESS**, including real Chromium.
Accepted Skirmish PR CI: `33069287273` / #883 — **SUCCESS**, including real Chromium.
Accepted Skirmish Cloudflare build: `f575d3d6-d62f-48bc-907d-4873e67ac154` — **SUCCESS**; Version `0727f70c-24a7-4dbc-aa1f-6559f968fd1e`.
Accepted Skirmish preview: `https://0727f70c-rpchess.mobigametim.workers.dev`.

Accepted Battle gameplay head: `40f234740783699b564dc53db7783d36d5ae5e7f`.
Accepted Battle version: `2.5.0-battle.preview.1`.
Accepted Battle push CI: `33073454223` / #891 — **SUCCESS**, including full real Chromium regression acceptance.
Accepted Battle Cloudflare build: `855b8d21-3dbf-42e2-9dac-3646c2061d41` — **SUCCESS**; Version `9ba31509-3bf7-4853-b7af-ac77a9664f85`.
Accepted Battle preview: `https://9ba31509-rpchess.mobigametim.workers.dev`.

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
