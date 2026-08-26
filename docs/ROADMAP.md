# RPChess Reboot Roadmap

- [x] Концепция Reboot утверждена.
- [x] Legacy branch создан до изменения gameplay.
- [x] Reboot Foundation — production-ready visual shell без старых gameplay-систем. Human accepted 2026-08-26; production-menu и audio corrections included.
- [ ] Classic Chess — полный локальный классический шахматный runtime. **IMPLEMENTED → ENGINE-AUTOTESTED → DEPLOYED → HUMAN GAMEPLAY TEST PASSED; scene-switch spot-check pending.** Пользователь подтвердил, что все пункты gameplay/UX playtest прошли успешно; найден единственный presentation defect: главное меню не выходило из layout и доска появлялась ниже страницы. Исправлен explicit hidden-state contract для scene roots, добавлена regression coverage. Canonical perft: start d3 = 8902; Kiwipete d1/d2/d3 = 48/2039/97862; canonical endgame d3 = 2812. Hosted Chromium execution всё ещё заблокирован GitHub Actions runner до первого step.
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
**Classic Chess — SCENE-SWITCH SPOT-CHECK.** Основной human playtest пройден. Нужно только подтвердить, что `Новая игра` теперь заменяет главное меню игровой сценой, а `Главное меню` полностью скрывает шахматную сцену. Chess AI до этого короткого подтверждения не начинается.

## Статусы feature
`IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DONE`

## Правило разработки
После каждой feature создаётся deploy preview. Следующая feature не начинается, пока пользователь не проведёт живой playtest там, где feature требует human acceptance.

## Legacy boundary
Iron Marches v1 сохранён в `archive/iron-marches-v1` на `035fb817a93f53047a1d20f7cdfc9093b0f7d611` и не загружается Reboot runtime.
