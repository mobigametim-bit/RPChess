# 03 — Travel System

## Путешествие без заранее построенной карты

RPChess не использует заранее собранную campaign map. После старта путешествия и после каждого завершённого не-финального encounter игрок получает **ровно три карточки следующего пути**.

Текущий production flow:

`Отряд → Начать путешествие → Travel Choice → encounter → aftermath/результат → Продолжить путь → новый Travel Choice`.

Если персонализированный King погибает, run завершается и новый Travel Choice не создаётся.

## UX Travel Choice

- отдельная полноэкранная сцена;
- верхний заголовок содержит только **«Неделя путешествия N»** и использует `BrahmsGotischCyr`;
- desktop: три карточки пути рядом;
- mobile: три карточки вертикально, только vertical scroll, без horizontal overflow/carousel;
- каждая карточка показывает тип encounter, короткую world-flavor фразу и текущую стоимость перехода;
- `Skirmish`/`Battle` показывают угрозу по общей **12-звёздной шкале `★1–12`**;
- `Puzzle` показывает собственную недельную сложность `★1–12`;
- `Settlement` показывается как безопасное место без combat threat;
- `Event` не раскрывает заранее список решений или outcome-текст;
- **вся карточка является действием выбора**;
- клик сразу фиксирует выбор и запускает соответствующий encounter;
- второго CTA, `Подтвердить`, confirmation modal и отмены после выбора нет;
- `Отряд` можно открыть до выбора пути;
- возврат из Roster и reload до выбора сохраняют **тот же набор из трёх карточек**.

Для длинной 12-звёздной combat-строки допускается единственная безопасная точка переноса после шестой звезды, поэтому 12 звёзд могут отображаться как **6 + 6** без horizontal overflow.

## Необратимость выбора

После клика выбранная карточка сохраняется как `activeTravelChoice`, а текущая тройка очищается. Пока соответствующий encounter не завершён, возврат через Roster или reload возобновляет **уже выбранный encounter**, а не новую развилку.

- Skirmish/Battle считаются завершёнными после увеличения соответствующего combat counter;
- Settlement очищает route при выходе через `Продолжить путь`;
- Event очищает route после resolved outcome и, если он запустил combat, после окончания связанного боя;
- Puzzle сохраняет `currentPuzzle` и очищает route только после solved/failed outcome и `Продолжить путь`.

## Resources + Starvation integration

Каждый **новый committed Travel transition** расходует **1 Supply**.

- стоимость видна на карточке до выбора;
- списание выполняется в той же persistence operation, которая фиксирует `activeTravelChoice`;
- выбранный путь сохраняет `supplyCostAtSelection` и `supplyPaid`;
- возврат через Roster, Event/Puzzle resume или reload не списывает Supply повторно;
- Supplies никогда не уходят ниже нуля;
- если при committed transition `supplies = 0`, Starvation детерминированно убивает ровно одну живую персонализированную фигуру до запуска encounter;
- victim id сохраняется до dispatch, поэтому reload не перебрасывает жертву;
- смерть King немедленно завершает run;
- после acknowledgement non-King casualty запускается уже выбранный encounter без второго списания.

Gold/Supplies не меняют типы карточек и не перебрасывают deterministic route fork.

## Канонические playable-типы

Текущий playable pool состоит из пяти типов:

- `Skirmish` — стычка;
- `Battle` — сражение;
- `Settlement` — поселение;
- `Event` — событие;
- `Puzzle` — шахматная задача.

Puzzle больше не является зарезервированной заглушкой: `feature/puzzles` маршрутизирует карточку в полноценную Puzzle scene.

## Генерация текущей версии

Тройка детерминирована по `run.id + journeyStep`, поэтому одинаковое состояние run создаёт одинаковый набор.

Каждая из трёх карточек **независимо** выбирает один из пяти playable типов:

`Skirmish / Battle / Settlement / Event / Puzzle`.

Контракт распределения:

- каждый тип имеет долгосрочную вероятность около **20% на каждую карточку**;
- дубликаты допустимы: одна тройка может содержать 2–3 карточки одного типа;
- нет гарантии хотя бы одного combat encounter;
- один и тот же `run.id + journeyStep` всегда воспроизводит ту же тройку;
- разные недели используют новые deterministic route seeds.

Для каждой карточки рассчитываются отдельный route seed, world-flavor и internal mechanical hint.

### Combat stars

Для `Skirmish`/`Battle` базовая угроза растёт примерно на одну звезду каждые две недели:

`1 + floor((journeyStep - 1) / 2)`

Затем применяется deterministic offset `-2…+2` и clamp `1…12`. Combat route также получает enemy race theme и сторону игрока.

### Puzzle stars

Puzzle **не использует combat threat roll**. Его сложность зависит только от номера недели:

`stars = min(12, floor((week - 1) / 8) + 1)`

То есть недели 1–8 → ★1, 9–16 → ★2, …, 81–88 → ★11, 89+ → ★12. Raw Lichess rating игроку не показывается; он используется только при формировании difficulty pool.

## Flavor-content

Для всех пяти типов существует отдельный world-flavor pool. Фраза выбирается детерминированно по route seed. Если в одной тройке несколько карточек одного типа, runtime старается не повторять одну и ту же flavor-фразу, пока pool позволяет выбрать уникальную.

## Persistence

Схема `rpchess.reboot.v1.run` остаётся обратно совместимой и содержит:

- `journeyStep`;
- `currentTravelChoices`;
- `activeTravelChoice`;
- `supplyCostAtSelection`;
- `supplyPaid`;
- Starvation metadata;
- encounter-specific state (`currentSettlement`, `currentEvent`, `currentPuzzle` и combat aftermath metadata).

Старые saves без новых полей гидратируются безопасными значениями. Уже выбранный route после reload остаётся необратимым.

## Encounter routing

### Skirmish

Travel передаёт route seed/stars, race theme и player color в Skirmish generator. После aftermath `Продолжить путь` открывает новую тройку.

### Battle

Travel передаёт route seed/stars, race theme и player color в Battle generator. После aftermath `Продолжить путь` открывает новую тройку.

### Settlement

Безопасный encounter: healer, recruitment и supply shop. Вход оплачивается обычным Travel Supply cost. Выход не списывает второй Supply.

### Event

Открывает mini-story scene с 3–5 решениями, deterministic roll и persistent outcome. Event может завершиться мгновенным эффектом или запустить Skirmish/Battle. Event → Combat не списывает второй Supply.

### Puzzle

Открывает offline Puzzle scene на обычной 8×8 доске со стандартными белыми/чёрными фигурами. Route stars вычисляются только по восьминедельной Puzzle-кривой. Прогресс решения, ошибки и reward receipt сохраняются. Puzzle resume не списывает Supply повторно.

## Исторические drafts

Ранний weighted draft `Puzzle 20% / Skirmish 25% / Battle 15% / Event 25% / Settlement 15%` больше не является production алгоритмом.

Events v1 временно использовал четыре реализованных типа по ~25%. С утверждением Puzzles v1 этот переходный контракт заменён текущим независимым равновероятным **five-type pool ≈20/20/20/20/20**.

## Границы Travel System

Travel orchestration отвечает за генерацию тройки, committed route, Supply/Starvation gate и dispatch encounter. Внутренняя логика Skirmish, Battle, Settlement, Event и Puzzle принадлежит соответствующим feature-модулям.

Региональные modifiers, anti-streak rules и отдельные weighted encounter tables не входят в Puzzles v1.

## Human Acceptance базового Travel Choice

Базовый Travel Choice был принят пользователем 2026-08-27 и закрыт в `main`.

Accepted gameplay head: `d76fca5ad5e02260a836400c7398158c1657a6f6`.  
Version: `2.6.0-travel-choice.preview.1`.  
Final acceptance push CI `33084047611` / #905: **SUCCESS**.  
Final acceptance PR CI `33084052567` / #906: **SUCCESS**.  
Final exact-head Cloudflare build `b7e9b7dc-9a5c-40aa-b608-6c2c3b438676`: **SUCCESS**; Version `8853fbcc-7e7a-4e49-a83e-c2df68d2f7d5`.  
PR #70 squash-merged в `main` как `ee7d1b348ac88ebafcd334acb84167f6b5a12bdc`.

## Текущий lifecycle

Базовый Travel Choice остаётся **DONE**. Resources, Settlement, Starvation и Events уже расширили его поверх принятого контракта.

Puzzles v1 меняет playable pool с четырёх на пять типов, добавляет Puzzle-specific week difficulty и Puzzle resume semantics. Эта новая часть остаётся **IMPLEMENTED / acceptance pending** до canonical gate, Cloudflare preview и отдельного живого пользовательского playtest.
