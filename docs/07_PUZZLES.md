# 07 — Puzzles

## Статус

Puzzles v1 UX/spec **утверждён пользователем 2026-08-29**. Реализация ведётся в `feature/puzzles`; feature нельзя сливать до deploy preview и отдельного human playtest/acceptance.

## Поддерживаемые типы v1

- мат в 1;
- мат в 2;
- мат в 3;
- выигрыш конкретной фигуры.

Для material puzzle цель всегда показывается явно:
- `ВЫИГРАЙТЕ ФЕРЗЯ`;
- `ВЫИГРАЙТЕ ЛАДЬЮ`;
- `ВЫИГРАЙТЕ СЛОНА`;
- `ВЫИГРАЙТЕ КОНЯ`.

Игрок не должен угадывать, какой из нескольких материально выгодных вариантов считается решением. В curated library допускаются только позиции, где целевая фигура и forced line однозначно валидируются.

## Источник контента

Основной production-source — **Lichess Open Database: Puzzles**, CC0/public-domain dataset. Книги Сергея Иващенко не используются как источник production puzzle library.

Полная многомиллионная база не поставляется с игрой. Developer importer выбирает и валидирует curated offline subset; runtime не обращается к Lichess во время игры.

Ориентир первой библиотеки — около **2000 задач**. Точный объём может быть уменьшен, если строгие quality/rating/type фильтры не дают достаточно качественных позиций; требования качества не ослабляются молча ради круглого числа.

## Lichess import contract

Исходные поля включают `PuzzleId`, `FEN`, `Moves`, `Rating`, `RatingDeviation`, `Popularity`, `NbPlays`, `Themes`, `GameUrl`, `OpeningTags` и актуальное дополнительное metadata-поле source dataset.

Lichess FEN хранит позицию **до** последнего ошибочного хода партии. Importer должен:
1. загрузить исходный FEN;
2. применить первый UCI-ход из `Moves`;
3. сохранить полученную позицию как фактический puzzle start;
4. сохранить оставшуюся forced line как решение;
5. повторно проверить legality/result chess engine;
6. для material puzzles определить конкретную обязательную целевую фигуру и исключить неоднозначные позиции.

Для `mateIn1` runtime не требует единственный source UCI: любой легальный ход, который действительно ставит мат, считается правильным.

Quality filters v1:
- `Popularity >= 80`;
- `RatingDeviation <= 100`;
- позиция и solution line валидны;
- material puzzle не является замаскированным mate puzzle;
- `targetPiece` однозначен;
- слишком длинные material lines можно отбрасывать.

Кандидаты material puzzle могут приходить из `hangingPiece`, `fork`, `skewer`, `trappedPiece`, `capturingDefender`, `pin`, но theme сам по себе не является достаточным доказательством target/result.

## Нормализованный формат

Минимальные поля:

`id`, `sourceId`, `fen`, `side`, `solution`, `type`, `rating`, `difficulty`, `themes`, `targetPiece`, `materialGain`, `reward`.

`targetPiece` обязателен для material puzzle (`queen`, `rook`, `bishop`, `knight`) и отсутствует/null для mate puzzle.

## Travel integration

Puzzle — пятый playable Travel type вместе с `Skirmish`, `Battle`, `Settlement`, `Event`.

Каждая из трёх Travel-карточек независимо выбирает один из пяти типов, поэтому долгосрочная доля каждого типа близка к **20%**; дубликаты внутри одной тройки разрешены.

Выбор Puzzle-карточки — обычный committed travel transition и стоит **1 Supply**. При переходе без припасов сначала применяется существующий Starvation flow; после acknowledgement выбранная Puzzle-встреча продолжается. Reload/resume не списывает Supply второй раз.

## Сложность ★1…★12

Puzzle использует тот же визуальный язык сложности, что Skirmish/Battle. Raw Lichess Rating игроку не показывается.

Текущая временная progression-формула привязана только к номеру недели и в будущем может быть заменена:

`stars = min(12, floor((week - 1) / 8) + 1)`

| ★ | Недели | Lichess Rating | Type mix |
|---:|---:|---:|---|
| ★1 | 1–8 | 600–900 | 70% mate1 / 30% material |
| ★2 | 9–16 | 800–1050 | 60% mate1 / 40% material |
| ★3 | 17–24 | 950–1200 | 45% mate1 / 20% mate2 / 35% material |
| ★4 | 25–32 | 1100–1350 | 30% mate1 / 35% mate2 / 35% material |
| ★5 | 33–40 | 1250–1500 | 15% mate1 / 50% mate2 / 35% material |
| ★6 | 41–48 | 1400–1650 | 55% mate2 / 10% mate3 / 35% material |
| ★7 | 49–56 | 1550–1800 | 50% mate2 / 15% mate3 / 35% material |
| ★8 | 57–64 | 1700–1950 | 40% mate2 / 25% mate3 / 35% material |
| ★9 | 65–72 | 1850–2100 | 30% mate2 / 35% mate3 / 35% material |
| ★10 | 73–80 | 2000–2250 | 20% mate2 / 45% mate3 / 35% material |
| ★11 | 81–88 | 2150–2450 | 15% mate2 / 50% mate3 / 35% material |
| ★12 | 89+ | 2350–2800 | 10% mate2 / 55% mate3 / 35% material |

Travel card показывает `ЗАДАЧА` и ★-сложность. Puzzle scene показывает конкретную цель и `Сложность ★N`.

## UX решения

Puzzle использует обычную 8×8 шахматную доску RPChess, но не является полной партией. Позиция воспроизводится стандартными белыми/чёрными фигурами; персонализированный roster не подменяет фигуры задачи.

Игрок делает ход непосредственно на доске. После правильного хода forced reply соперника выполняется автоматически, затем управление возвращается игроку.

Неверный легальный ход:
- показывает короткое `Неверный ход`;
- сразу откатывается к позиции перед попыткой;
- увеличивает счётчик ошибок;
- не раскрывает правильный ход.

Всего **3 попытки**. Первая и вторая ошибки позволяют продолжить; третья ошибка завершает Puzzle как failed.

Material puzzle завершается, когда утверждённая solution line гарантированно реализовала выигрыш указанной фигуры; бессмысленный хвост исходной партии не доигрывается.

## Gold reward

Perfect reward:

`baseGold = 9 + 3 × stars`

Таким образом ★1 = 12 Gold, …, ★12 = 45 Gold.

Accuracy multiplier:
- 0 ошибок — **100%**;
- 1 ошибка — **70%**;
- 2 ошибки — **40%**;
- 3-я ошибка — failed, **0 Gold**.

Итог округляется до ближайшего целого Gold. Reward settlement persistent/idempotent: reload/resume не может выплатить награду повторно.

## Подсказки

**Hint-механика не входит в Puzzles v1.** Не добавлять кнопку подсказки, стандартный hint cost, автонамёки или раскрытие solution. Для подсказок будет отдельная будущая механика и отдельное UX-обсуждение.

## Persistence

Выбранная Puzzle-встреча и прогресс решения переживают reload/resume. Нужно сохранять как минимум puzzle id, route id, current FEN/solution index, errors, resolved/result и reward settlement receipt. Один committed Puzzle route всегда восстанавливает ту же задачу.

## Acceptance gate

До merge обязательны:
- deterministic tests для difficulty, type selection, source/normalized catalog validation, UCI line progression, mate-in-1 multi-solution rule, attempts и Gold formula;
- persistence/idempotency tests;
- Travel pool regression с 5 playable types и Puzzle route resume;
- desktop + 390×844 browser flow;
- canonical source verification + production build;
- Cloudflare preview;
- живой пользовательский playtest и explicit acceptance.

## Архитектурное правило

Puzzle engine не зависит от конкретного источника контента. Source-specific особенности Lichess изолируются в developer importer; runtime работает только с нормализованной offline library и существующим chess rules layer.
