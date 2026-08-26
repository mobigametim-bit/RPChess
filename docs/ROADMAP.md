# RPChess Reboot Roadmap

- [x] Концепция Reboot утверждена.
- [x] Legacy branch создан до изменения gameplay.
- [x] Reboot Foundation — production-ready visual shell без старых gameplay-систем. Human accepted 2026-08-26; production-menu и audio corrections included.
- [x] Classic Chess — полный локальный классический шахматный runtime. **IMPLEMENTED → ENGINE-AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DONE.** Пользователь успешно прошёл полный gameplay/UX playtest и финальный scene-switch spot-check. Исправлен exclusive scene visibility contract. Canonical perft: start d3 = 8902; Kiwipete d1/d2/d3 = 48/2039/97862; canonical endgame d3 = 2812.
- [ ] Chess AI — Stockfish adapter и уровни Elo. **IMPLEMENTED → deterministic adapter tests authored → deployment/human playtest pending.** Stockfish 18 lite single-threaded работает через отдельный Web Worker/WASM adapter; 12 уровней ≈400–2600 Elo; 400–1200 ослабляются через MultiPV + контролируемые ошибки, 1400+ используют UCI_LimitStrength/UCI_Elo. Есть выбор локальная партия / компьютер, Elo и цвета; при игре чёрными доска разворачивается, AI делает первый ход.
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
**Chess AI — implementation/deployment gate.** Следующий обязательный human gate — сыграть против слабого, среднего и сильного AI, проверить игру белыми/чёрными и локальный режим. Roster не начинается до принятия Chess AI.

## Статусы feature
`IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DONE`

## Правило разработки
После каждой feature создаётся deploy preview. Следующая feature не начинается, пока пользователь не проведёт живой playtest там, где feature требует human acceptance.

## CI note
GitHub-hosted Actions всё ещё может завершаться до первого workflow step из-за runner infrastructure. Для Chess AI Cloudflare build command усилен до `npm test && npm run build`, поэтому успешный exact-head Cloudflare build обязан пройти Node/static contracts перед упаковкой. Real Chromium не считается пройденным, если runner фактически не исполнил browser suite.

## Legacy boundary
Iron Marches v1 сохранён в `archive/iron-marches-v1` на `035fb817a93f53047a1d20f7cdfc9093b0f7d611` и не загружается Reboot runtime.
