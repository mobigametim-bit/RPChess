# RPChess Reboot Roadmap

- [x] Концепция Reboot утверждена.
- [x] Legacy branch создан до изменения gameplay.
- [x] Reboot Foundation — production-ready visual shell без старых gameplay-систем. Human accepted 2026-08-26; production-menu и audio corrections included.
- [x] Classic Chess — полный локальный классический шахматный runtime. **IMPLEMENTED → ENGINE-AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DONE.** Пользователь успешно прошёл полный gameplay/UX playtest и финальный scene-switch spot-check. Исправлен exclusive scene visibility contract: главное меню и шахматная сцена больше не могут одновременно оставаться в layout. Canonical perft: start d3 = 8902; Kiwipete d1/d2/d3 = 48/2039/97862; canonical endgame d3 = 2812. Hosted Chromium execution остаётся отдельным GitHub Actions runner blocker до первого step и не учитывается как пройденный CI.
- [ ] Chess AI — Stockfish adapter и уровни Elo.
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
**Classic Chess accepted; merge to `main`, then Chess AI.** Следующая feature создаётся только от принятого Classic Chess `main` и должна добавить AI adapter + уровни Elo без изменения классических правил шахмат.

## Статусы feature
`IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DONE`

## Правило разработки
После каждой feature создаётся deploy preview. Следующая feature не начинается, пока пользователь не проведёт живой playtest там, где feature требует human acceptance.

## Legacy boundary
Iron Marches v1 сохранён в `archive/iron-marches-v1` на `035fb817a93f53047a1d20f7cdfc9093b0f7d611` и не загружается Reboot runtime.
