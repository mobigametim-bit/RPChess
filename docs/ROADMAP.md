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
- [x] Travel Choice — три случайных следующих пути после каждой встречи. **IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DONE.** Пользователь принял preview 2026-08-27. Ровно 3 persistent deterministic cards; card click сразу фиксирует необратимый выбор и запускает encounter; Roster/reload не перегенерируют развилку; текущий playable pool — Skirmish + Battle; aftermath возвращает в следующую тройку через `Продолжить путь`.
- [x] Resources — Gold + Supplies. **IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DONE.** New run: 80 Gold / 10 Supplies; новый committed travel transition стоит 1 Supply; Skirmish/Battle дают deterministic Gold reward один раз; resource HUD persistent; Starvation casualty намеренно остаётся отдельным этапом после Settlement. Пользователь подтвердил live preview 2026-08-27: «все работает, золото начисляется, припасы тратятся». PR #71 squash-merged в `main`; post-merge CI и Cloudflare production прошли SUCCESS.
- [x] Settlement — лечение, найм, снабжение. **IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DONE.** Пользователь завершил live playtest 2026-08-27 и подтвердил: «проверил, все хорошо, все работает». Safe Settlement route, healer, deterministic tavern recruits, finite Supply shop, persistence/reload и mobile flow приняты. PR #73 squash-merged; post-merge GitHub Actions #955 и Cloudflare production прошли SUCCESS.
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
**Settlement полностью закрыт как DONE. Следующий этап — UX/spec discussion для Starvation. Gameplay implementation Starvation ещё не начат.**

Текущий Settlement v1 contract:
- Travel playable pool: `Skirmish / Battle / Settlement`, при этом каждая тройка гарантирует минимум одну Стычку и одну Битву;
- Settlement route стоит обычный `-1 Supply`, безопасная карточка скрывает combat stars/threat;
- healer: wounded → healthy за Pawn 10 / Knight 18 / Bishop 18 / Rook 26 / Queen 42 Gold;
- tavern: 3 deterministic offers из 33 non-King named heroes; цены Pawn 24 / Knight 42 / Bishop 42 / Rook 64 / Queen 96 Gold;
- supply shop: 12 Gold за 1 Supply, локальный stock 4;
- purchases, offers и stock persist через reload/Roster;
- `ПРОДОЛЖИТЬ ПУТЬ` возвращает к следующей Travel Choice без дополнительного Supply charge;
- mobile 390×844 — vertical layout без horizontal overflow.

Settlement accepted gameplay head: `92e9387d5afe806af47f05a23105622309742be4`.  
Settlement version: `2.8.0-settlement.preview.1`.  
Gameplay GitHub Actions `33114651996` / #946 — **SUCCESS**, включая full real Chromium regression Foundation → Classic Chess → Stockfish → Roster → Skirmish → Battle → Travel Choice → Resources → Settlement.  
Accepted gameplay Cloudflare build `1aaa73d9-064b-4e01-ae51-62abfb0ec9a9` — **SUCCESS**; Version `a79ca435-1006-4f3e-bd0a-c2cac5dd8f4b`.  
Accepted preview: `https://a79ca435-rpchess.mobigametim.workers.dev`.  
Human acceptance: **accepted 2026-08-27**.  
Final feature head: `60c2bcbe616f6d1dc189e70cab8a0211d07274c1`.  
Exact-head GitHub Actions `33118757504` / #953 — **SUCCESS**.  
PR-triggered GitHub Actions `33125160839` / #954 — **SUCCESS**.  
Exact-head Cloudflare build `9a09d556-0645-424e-83f4-7b2a1b460989` — **SUCCESS**; Version `d6b52b6a-7b66-4b81-950c-f7122dad0551`.  
PR #73 squash-merge / production `main`: `854a0bd4535c6b3006fa11a207a011f3e3e2a0f2`.  
Post-merge GitHub Actions `33125831513` / #955 — **SUCCESS**.  
Post-merge Cloudflare production build `6c973861-a04d-415b-b1fa-df1c110ee6d2` — **SUCCESS**; Version `86a0ce13-e9eb-4366-b853-dc456ec7ba97`.

Текущий Resources v1 contract:
- new run: `Gold 80`, `Supplies 10`;
- every newly committed Travel Choice route: `-1 Supply`;
- resuming/reloading an already committed route: no second charge;
- Supplies never negative;
- Skirmish victory `12 + 4×stars`, draw half, loss 0;
- Battle victory `20 + 6×stars`, draw half, loss 0;
- reward settlement idempotent;
- at 0 Supplies Resources itself does not kill a character yet: canonical death consequence remains isolated to the later **Starvation** feature.

Resources merge SHA: `c4e98b7f2bdbf926727ceec7bee15099919ea19d`.  
Resources post-merge docs/current main before Settlement: `1f3cac1bc9cd6231d4796eeb70e9bc19ccdd154f`.  
Resources post-merge GitHub Actions `33110864306` / #944 — **SUCCESS**.

Accepted Travel Choice gameplay head: `d76fca5ad5e02260a836400c7398158c1657a6f6`.  
Accepted Travel Choice version: `2.6.0-travel-choice.preview.1`.  
Accepted Travel Choice preview: `https://7047b3fb-rpchess.mobigametim.workers.dev`.

Accepted Roster gameplay head: `21486014ca110062fdcb776d5119b23dbe3418cf`.  
Accepted Roster version: `2.3.0-roster.preview.3`.  
Accepted Roster preview: `https://78461dc1-rpchess.mobigametim.workers.dev`.

Accepted Skirmish corrected gameplay head: `b11f712e63366a70f35c0de8fd0b823159dad0cd`.  
Accepted Skirmish version: `2.4.0-skirmish.preview.2`.  
Accepted Skirmish preview: `https://0727f70c-rpchess.mobigametim.workers.dev`.

Accepted Battle gameplay head: `40f234740783699b564dc53db7783d36d5ae5e7f`.  
Accepted Battle version: `2.5.0-battle.preview.1`.  
Accepted Battle preview: `https://9ba31509-rpchess.mobigametim.workers.dev`.

## Статусы feature
`IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DONE`

## Правило разработки
После каждой feature создаётся deploy preview. Следующая feature не начинается, пока пользователь не проведёт живой playtest там, где feature требует human acceptance, и текущая feature не закрыта merge/post-merge gates.

## Global UI invariant
Все текущие и будущие production surfaces являются **frameless CSS-only panels**. Активный Reboot UI не использует `ui_panel_frame.png` или `ui_panel_wide.png`. Панели используют общий `--ui-panel-*` visual contract и `--ui-panel-safe-*` / `.ui-panel-safe` safe-area contract. Контент не касается внешней границы; левый внутренний отступ немного больше правого. Синий `ui_button_primary.png` остаётся approved CTA asset.

## CI note
Каждый merge gate требует source/static/engine/adapter/persistence tests, build/distribution boundary, real Chromium acceptance и Cloudflare SUCCESS на exact gameplay/docs head. Static verification отдельно запрещает возврат ornate panel-frame assets в active Reboot CSS.

## Legacy boundary
Iron Marches v1 сохранён в `archive/iron-marches-v1` на `035fb817a93f53047a1d20f7cdfc9093b0f7d611`. Reboot не загружает старый runtime, но разрешено повторно использовать утверждённые визуальные ассеты из repository asset library, кроме запрещённых production panel-frame assets.
