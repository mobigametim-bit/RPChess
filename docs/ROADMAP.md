# RPChess Reboot Roadmap

- [x] Концепция Reboot утверждена.
- [x] Legacy branch создан до изменения gameplay.
- [x] Reboot Foundation — production-ready visual shell без старых gameplay-систем. Human accepted 2026-08-26; production-menu и audio corrections included.
- [x] Classic Chess — полный локальный классический шахматный runtime. **IMPLEMENTED → ENGINE-AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DONE.** Пользователь успешно прошёл полный gameplay/UX playtest и финальный scene-switch spot-check. Исправлен exclusive scene visibility contract. Canonical perft: start d3 = 8902; Kiwipete d1/d2/d3 = 48/2039/97862; canonical endgame d3 = 2812.
- [x] Chess AI — Stockfish adapter и уровни Elo. **IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DONE.** Stockfish 18 lite single-threaded работает через отдельный Web Worker/WASM adapter; 12 уровней ≈400–2600 Elo. Пользователь подтвердил AI gameplay, SAN/figurines, captured material, плавные ходы, production UI polish и финальный game-wide framed-content safe-area invariant.
- [ ] Roster — персонализированный король и фигуры.
- [ ] Skirmish — ≤16 фигур, ≤39 очков, adaptive enemy.
- [ ] **PLAYTEST GATE: интересность собственного состава.**
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
**Roster — UX design gate before implementation.** Chess AI принят и закрыт. После merge PR #66 создаётся `feature/roster`, но код Roster не начинается, пока пользователь не утвердит UX персонализированного короля, roster screen и взаимодействия с персонализированными фигурами.

## Статусы feature
`IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DONE`

## Правило разработки
После каждой feature создаётся deploy preview. Следующая feature не начинается, пока пользователь не проведёт живой playtest там, где feature требует human acceptance.

## Global UI invariant
Все текущие и будущие framed surfaces используют единый `--ui-frame-safe-*` / `.ui-frame-safe` контракт. Контент не касается декоративной рамки; левый внутренний отступ немного больше правого. Это правило зафиксировано в `16_UI_UX.md` и считается обязательным для всех последующих feature.

## CI note
Каждый merge gate требует source/static/engine/adapter tests, build/distribution boundary, real Chromium acceptance и Cloudflare SUCCESS на exact head.

## Legacy boundary
Iron Marches v1 сохранён в `archive/iron-marches-v1` на `035fb817a93f53047a1d20f7cdfc9093b0f7d611` и не загружается Reboot runtime.
