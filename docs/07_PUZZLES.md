# 07 — Puzzles

## Статус

Puzzles v1 — **IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DOCS SYNCED → DONE**.

- UX/spec approved: 2026-08-29.
- Human acceptance: 2026-08-29 — пользователь подтвердил финальный retest: «всё хорошо».
- Exact accepted gameplay head: `393fa3e6c4dda08186de75a8ae22d6aa442c0957`.
- Accepted-head Cloudflare build: `0942b70f-e0e7-47d0-86c9-2572917cf5de` — **SUCCESS**.
- Accepted preview: `https://f074203e-rpchess.mobigametim.workers.dev`.
- Draft PR #80 закрыт без merge только из-за connector GitHub GraphQL Draft→Ready incompatibility (`fullDatabaseId`).
- Тот же exact tree/head открыт как non-Draft PR #81 и squash-merged без промежуточных gameplay changes.
- Production merge: `9aec0e12d3299656fb3c062b07c592e1d8332aab`.
- Следующий этап: **Encounter Generator — UX/spec discussion**; implementation не начат.

Финальный live retest дополнительно закрыл три acceptance-blocker:
1. на Puzzle-board восстановлены orientation-aware координаты и технический шахматный глиф в левом верхнем углу каждой занятой клетки;
2. добавлен persistent no-repeat history задач с migration из старого `lastPuzzle`;
3. Event→Skirmish start исправлен в корне: enemy generator теперь не может создать больше 8 пешек, что соответствует физической formation; добавлен широкий deterministic seed regression.

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

Source attribution хранится в проектной документации и metadata, но после live correction 2026-08-31 строка `Задачи: Lichess Open Database · CC0` больше не показывается внутри gameplay-панели Puzzle.

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

Активный runtime Puzzle difficulty **не определяется номером недели**. Неделя сохраняется только как compatibility/import metadata для старых сохранений и catalog bands.

Текущий runtime contract:
- базовая сложность вычисляется из текущей `Power` игрока: `baseStars = threatStarsForPower(Power)`;
- конкретный route получает deterministic adaptive offset `+0 / +1 / +2 / +3` с весами `40% / 30% / 20% / 10%`;
- итог clamped в диапазоне `★1…★12`;
- Puzzle выбирается из каталога по **точному итоговому `★N`** route;
- Travel card показывает конкретное `★N` и подпись `СЛОЖНОСТЬ ЗАДАЧИ`;
- Puzzle scene показывает тот же `★N` и рассчитывает Gold reward от него.

Формула старого week-based helper `min(12, floor((week - 1) / 8) + 1)` остаётся только для backward compatibility/import tooling и не управляет активным runtime.

Таблица ниже описывает catalog bands для каждого `★N`; колонка «Недели» — legacy/import metadata, а не активная progression-формула.

| ★ | Недели (legacy/import) | Lichess Rating | Type mix |
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

Live correction 2026-08-31 удаляет старый presentation override `★1–★12 / СЛУЧАЙНАЯ СЛОЖНОСТЬ`: он перезаписывал уже корректно рассчитанный Power-based `choice.stars`, не меняя механику выбора задачи.

## UX решения

Puzzle использует обычную 8×8 шахматную доску RPChess, но не является полной партией. Позиция воспроизводится стандартными белыми/чёрными фигурами; персонализированный roster не подменяет фигуры задачи.

Puzzle-board сохраняет обычный chess-board reading contract: orientation-aware координаты `a–h / 1–8` и технический chess glyph каждой занятой клетки отображаются в левом верхнем углу.

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

## Persistence / no-repeat

Выбранная Puzzle-встреча и прогресс решения переживают reload/resume. Сохраняются puzzle id, route id, current FEN/solution index, errors, resolved/result и reward settlement receipt. Один committed Puzzle route всегда восстанавливает ту же задачу.

Забег дополнительно хранит persistent history уже сыгранных Puzzle. Selection исключает просмотренные задачи до исчерпания доступного пула; после этого допускается новый цикл. Для совместимости сохранение предыдущего preview автоматически переносит `lastPuzzle` в history.

## Event→Skirmish compatibility

Event-origin combat использует тот же Skirmish formation contract. Генератор enemy army обязан соблюдать `pawnCount <= 8`, потому что пешки размещаются на одной front rank. Этот invariant закрывает runtime exception при `Начать стычку`; deterministic regression покрывает широкий набор seed/★ комбинаций.

## Acceptance gate — CLOSED

Закрыты:
- deterministic tests для difficulty, type selection, source/normalized catalog validation, UCI line progression, mate-in-1 multi-solution rule, attempts и Gold formula;
- persistence/idempotency + no-repeat migration tests;
- Travel pool regression с 5 playable types и Puzzle route resume;
- desktop + 390×844 browser coverage;
- board coordinate/glyph contract;
- broad Skirmish formation seed regression;
- canonical source verification + production build;
- Cloudflare accepted-head preview;
- живой пользовательский playtest и explicit acceptance.

Human acceptance получен 2026-08-29; Puzzles v1 находится в `main`.

## Архитектурное правило

Puzzle engine не зависит от конкретного источника контента. Source-specific особенности Lichess изолируются в developer importer; runtime работает только с нормализованной offline library и существующим chess rules layer.
