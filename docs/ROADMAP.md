# RPChess Reboot Roadmap

- [x] Концепция Reboot утверждена.
- [x] Legacy branch создан до изменения gameplay.
- [x] Reboot Foundation — production-ready visual shell без старых gameplay-систем. Human accepted 2026-08-26; production-menu и audio corrections included.
- [x] Classic Chess — полный локальный классический шахматный runtime. **IMPLEMENTED → ENGINE-AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DONE.** Пользователь успешно прошёл полный gameplay/UX playtest и финальный scene-switch spot-check. Исправлен exclusive scene visibility contract. Canonical perft: start d3 = 8902; Kiwipete d1/d2/d3 = 48/2039/97862; canonical endgame d3 = 2812.
- [ ] Chess AI — Stockfish adapter и уровни Elo. **IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED pending.** Stockfish 18 lite single-threaded работает через отдельный Web Worker/WASM adapter; 12 уровней ≈400–2600 Elo; 400–1200 ослабляются через MultiPV + контролируемые ошибки, 1400+ используют UCI_LimitStrength/UCI_Elo. Есть выбор локальная партия / компьютер, Elo и цвета; при игре чёрными доска разворачивается, AI делает первый ход. Exact-head Cloudflare build `c30d9ee0-a103-47a2-af82-26f2b4030d2b` прошёл `npm test && npm run build`; Version ID `bfd59124-31ad-492f-ac36-198080c9a988`.
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
**Chess AI — HUMAN PLAYTEST GATE.** Нужно сыграть против слабого, среднего и сильного AI, проверить игру белыми/чёрными и локальный режим. Roster не начинается до принятия Chess AI.

## Статусы feature
`IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DONE`

## Правило разработки
После каждой feature создаётся deploy preview. Следующая feature не начинается, пока пользователь не проведёт живой playtest там, где feature требует human acceptance.

## CI note
GitHub-hosted Actions всё ещё завершается до первого workflow step из-за runner infrastructure и не считается пройденным browser CI. Для Chess AI Cloudflare build command усилен до `npm test && npm run build`; exact-head deploy на `fb7e3087d41ad281cbf47325f2381adec02487c7` успешно прошёл этот gate. Real Chromium suite написан, но не помечается как исполненный без фактического runner execution.

## Legacy boundary
Iron Marches v1 сохранён в `archive/iron-marches-v1` на `035fb817a93f53047a1d20f7cdfc9093b0f7d611` и не загружается Reboot runtime.
