# RPChess Reboot Roadmap

- [x] Концепция Reboot утверждена.
- [x] Legacy branch создан до изменения gameplay.
- [x] Reboot Foundation — production-ready visual shell без старых gameplay-систем. Human accepted 2026-08-26; production-menu и audio corrections included.
- [x] Classic Chess — полный локальный классический шахматный runtime. **IMPLEMENTED → ENGINE-AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DONE.** Пользователь успешно прошёл полный gameplay/UX playtest и финальный scene-switch spot-check. Исправлен exclusive scene visibility contract. Canonical perft: start d3 = 8902; Kiwipete d1/d2/d3 = 48/2039/97862; canonical endgame d3 = 2812.
- [ ] Chess AI — Stockfish adapter и уровни Elo. **IMPLEMENTED → AUTOTESTED → DEPLOYED → gameplay HUMAN TEST PASSED → final global-safe-area spot-check pending.** Stockfish 18 lite single-threaded работает через отдельный Web Worker/WASM adapter; 12 уровней ≈400–2600 Elo; 400–1200 ослабляются через MultiPV + контролируемые ошибки, 1400+ используют UCI_LimitStrength/UCI_Elo. Пользователь подтвердил AI/gameplay и предыдущий UI polish. Последнее замечание превращено в глобальный UI invariant: все framed surfaces держат текст/controls внутри внутренней тёмной safe-area, не касаясь decorative frame; слева используется дополнительный inset.
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
**Chess AI — global framed-content safe-area exact-head deploy + short HUMAN SPOT-CHECK.** После successful exact-head CI + Cloudflare deploy нужно проверить safe-area окна новой партии и текущих панелей. Roster не начинается до финального принятия Chess AI.

## Статусы feature
`IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DONE`

## Правило разработки
После каждой feature создаётся deploy preview. Следующая feature не начинается, пока пользователь не проведёт живой playtest там, где feature требует human acceptance.

## Global UI invariant
Все текущие и будущие framed surfaces используют единый `--ui-frame-safe-*` / `.ui-frame-safe` контракт. Контент не касается декоративной рамки; левый внутренний отступ немного больше правого. Это правило зафиксировано в `16_UI_UX.md` и считается обязательным для всех последующих feature.

## CI note
GitHub Actions runner исполняет полный browser suite. Chess AI final safe-area preview обязан пройти source/static/engine/adapter tests, build/distribution boundary и real Chromium + Stockfish acceptance на exact head, после чего тот же head должен получить Cloudflare SUCCESS.

## Legacy boundary
Iron Marches v1 сохранён в `archive/iron-marches-v1` на `035fb817a93f53047a1d20f7cdfc9093b0f7d611` и не загружается Reboot runtime.
