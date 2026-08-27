# 11 — Chess AI

## Цель feature
Добавить компьютерного соперника поверх принятого классического шахматного ядра, не меняя правила шахмат и не связывая игровой runtime напрямую с конкретным движком.

## Архитектура

```text
ClassicChessEngine
        ↓
 ChessAIAdapter
        ↓
Stockfish 18 lite single-threaded
        ↓
 Web Worker + WASM
```

`classic-chess-app.mjs` работает только через `ChessAIAdapter`.

## Движок
Используется Stockfish.js / Stockfish 18 `lite single-threaded`. Distribution build загружает закреплённые release-файлы Stockfish 18.0.0, проверяет SHA-256 и поставляет Worker/WASM вместе с GPLv3 `COPYING.txt` и `SOURCE.txt`.

## Шкала сложности

| Уровень | Ориентир |
|---|---:|
| Новичок I | ≈400 Elo |
| Новичок II | ≈600 Elo |
| Любитель | ≈800 Elo |
| Любитель+ | ≈1000 Elo |
| Клубный новичок | ≈1200 Elo |
| Клубный | ≈1400 Elo |
| Сильный клубный | ≈1600 Elo |
| Эксперт | ≈1800 Elo |
| Мастерский | ≈2000 Elo |
| Мастер+ | ≈2200 Elo |
| Очень сильный | ≈2400 Elo |
| Гроссмейстер | ≈2600 Elo |

Это игровые ориентиры, а не обещание точной турнирной рейтинговой калибровки.

## Ослабление AI
Для 400–1200 Stockfish рассчитывает несколько линий через `MultiPV`, после чего адаптер контролируемо выбирает более слабые, но всегда легальные варианты. Для 1400–2600 используются `UCI_LimitStrength`, `UCI_Elo` и основной `bestmove` Stockfish.

## UI новой партии
Игрок выбирает:
- `Против компьютера` или `Локальная партия`;
- уровень AI;
- белые / чёрные / случайный цвет.

При игре чёрными доска разворачивается к игроку, компьютер автоматически делает первый ход. На ходе AI пользовательский ввод блокируется, но большая плашка `Компьютер думает…` не перекрывает доску. Рассчитанный ход воспроизводится плавным перемещением фигуры.

## Production UI шахматной партии
Зафиксирован принятый контракт:
- fantasy-фигуры имеют небольшой bare technical chess glyph в верхнем левом углу клетки;
- white glyph — белый, black glyph — чёрный, без окружности/подложки;
- `Ходы` используют SAN + figurine notation, включая `x`, `+`, `#`, `O-O`, `O-O-O`, promotion и disambiguation;
- показываются взятые фигуры и material advantage;
- desktop: `Партия` слева / доска по центру / `Ходы` справа;
- широкая `Партия завершена…` status-плашка и duplicate post-game CTA отсутствуют;
- action-кнопки используют синий `ui_button_primary.png`;
- все framed surfaces подчиняются game-wide safe-area contract из `16_UI_UX.md`: текст/controls не касаются декоративной рамки, левый inset немного больше правого;
- reduced-motion может отключать плавное перемещение.

## Отказоустойчивость
Если Worker/WASM не инициализируется, адаптер использует только легальный fallback-ход и не нарушает шахматные правила.

## Тестовый контракт
Автоматически проверяются:
- 12 профилей Elo;
- UCI strength / MultiPV;
- контролируемое ослабление низких уровней;
- только легальные fallback-ходы;
- setup, board rotation и input lock;
- technical markers;
- SAN/figurines;
- captured material;
- smooth animation;
- blue CTA и commander-style surfaces;
- global framed-content safe-area;
- real Stockfish Worker browser flow.

## Human Playtest Gate
**HUMAN ACCEPTED → DONE.** Пользователь подтвердил:
- AI gameplay на разных уровнях сложности;
- игру белыми/чёрными и board rotation;
- production polish;
- SAN/figurines и captured material;
- плавные AI-ходы;
- финальный global framed-content safe-area spot-check.

Дополнительных замечаний по Chess AI не осталось.

## Accepted deployment evidence
- Accepted preview version: `2.2.0-chess-ai.preview.4`.
- Accepted gameplay/UI exact head: `556423dd31778def0d6245a4de1d221dc5a2299c`.
- GitHub Actions run `33026697784`, job `98369639263`: **SUCCESS**, включая real Chromium + real Stockfish.
- Cloudflare build `af7b2919-b1c2-44a4-be56-167453070c99`: **SUCCESS**.
- Cloudflare Version `7bf7d0e6-1cbb-4e91-8203-7b66319e7e14`.

Следующий этап — Roster. После merge Chess AI создаётся `feature/roster`, но реализация начинается только после отдельного согласования UX с пользователем.
