# 08 — Events

Events v1 — короткие фэнтезийные текстовые встречи внутри канонического journey loop. Каждое событие открывает мини-сцену, предлагает несколько решений и разрешается сразу: длинных event chains, политической системы и скрытых многошаговых квестовых веток нет.

## Travel integration

`Event` входит в текущий playable Travel pool наравне с `Skirmish`, `Battle` и `Settlement`.

Каждая из трёх карточек Travel Choice независимо получает тип из четырёх playable типов с равной вероятностью. Поэтому долгосрочная доля каждого типа близка к **25%**, а дубликаты одного типа внутри одной тройки допустимы. Отдельной гарантии наличия Skirmish/Battle больше нет.

Выбор Event-карточки фиксируется как обычный committed transition, расходует обычный `1 Supply` через Resources/Starvation слой и затем маршрутизируется в Events scene. Сам Event не списывает второй Supply.

## Каталог v1

Каталог содержит ровно **100 событий / 415 авторских решений**.

Распределение:
- Люди — 6;
- Эльфы — 6;
- Орки — 6;
- Нежить — 6;
- Тёмные эльфы — 6;
- Гномы — 6;
- Демоны — 6;
- Ангелы — 6;
- Дракониды — 6;
- Зверолюди — 6;
- Конструкты — 6;
- Животные — 6;
- Феи — 6;
- Гоблины — 6;
- нейтральные/смешанные — 16.

Все 100 событий имеют уникальный `E001…E100`, мини-рассказ минимум из трёх предложений и **3–5 решений**.

## Выбор следующего события

Events используют deterministic shuffle-bag:
- порядок 100 событий детерминирован по `run.id + cycle`;
- внутри одного цикла каждое событие появляется ровно один раз;
- после исчерпания 100 событий начинается новый детерминированный цикл;
- reload не меняет уже выбранное событие;
- история хранится в run state.

Это исключает повтор одного и того же Event до прохождения текущего полного мешка из 100 событий.

## UX сцены

Event открывается как отдельная полноэкранная сцена в общем frameless UI RPChess.

Игрок видит:
- название события;
- расу/тематику;
- мини-рассказ;
- 3–5 решений;
- шанс успеха для рискованных решений или пометку гарантированного исхода;
- role requirement, если решение требует конкретный тип фигуры;
- стоимость Gold/Supplies, если она есть;
- явные предупреждения о ранении, смерти, начале Skirmish/Battle и риске для Короля.

На mobile 390×844 используется vertical flow без горизонтального overflow.

## Role-gated решения

Некоторые варианты требуют здорового персонализированного героя конкретной роли: `Pawn`, `Knight`, `Bishop`, `Rook` или `Queen`.

Если подходящего героя нет, решение disabled и показывает причину. Для role-gated проверки берётся живой здоровый non-King герой соответствующей шахматной роли.

## Проверка исхода

Для выбранного решения выполняется deterministic roll `1–100`, привязанный к run, route seed, event и choice id.

- `roll <= chance` — успех;
- иначе — неудача;
- гарантированные решения используют 100%;
- один и тот же resolved Event не может быть бросен или применён повторно после reload.

После выбора сохраняются `choiceId`, `roll`, success/failure, итоговые notes и возможный combat outcome.

## Возможные эффекты

Поддерживаются:
- получить/потерять Gold;
- получить/потерять Supplies;
- потратить Gold/Supplies как цену решения;
- нанять персонализированную non-King фигуру из существующей hero library;
- тяжело ранить случайную non-King фигуру;
- мгновенно потерять случайную non-King фигуру;
- ранить выбранного role hero;
- потерять выбранного role hero;
- ранить King;
- убить King только в явно маркированных King-risk решениях;
- начать `Skirmish` или `Battle` с модификатором угрозы;
- не получить эффекта.

Экономика idempotent: цена и награда применяются один раз и не дублируются после reload/resume.

## Recruitment

`recruit` выбирает детерминированного доступного non-King героя из существующей recruitment library, исключая уже находящихся в roster.

Если свободных рекрутов не осталось, используется безопасный fallback `+18 Gold`, чтобы Event не ломал run state.

## Ранения и смерть

Обычные случайные death/wound эффекты **никогда не выбирают King**.

В утверждённом каталоге v1 ровно **4 решения**, которые действительно могут убить King. Каждое из них:
- имеет `kingRisk=true`;
- содержит явное UI-предупреждение о риске смерти Короля;
- при смерти King немедленно завершает run с Event end reason.

Если King только ранен, run продолжается. Wounded King остаётся обязательным и combat-eligible в последующих Skirmish/Battle, чтобы не возникал softlock.

## Event → Combat

Некоторые success/failure outcomes запускают Skirmish или Battle.

Event создаёт combat override с:
- типом боя;
- stars, рассчитанными от выбранной Travel угрозы с clamp `1–5`;
- deterministic seed;
- threat modifier из authored choice.

Переход Event → Combat **не списывает дополнительный Supply**. После завершения боя Event orchestration возвращает игрока в обычный journey loop.

## Persistence

Events используют текущую `rpchess.reboot.v1.run` и сохраняют как минимум:
- `eventHistory`;
- `currentEvent.routeId`;
- `currentEvent.eventId`;
- выбранный `choiceId`;
- `roll`;
- `success`;
- `resolved`;
- `outcome`;
- возможный Event combat state.

Reload/resume не меняет Event, не повторяет roll, не списывает стоимость второй раз и не применяет эффект повторно.

## Автоматические gates

Events contract покрывается deterministic Node tests и real-Chromium regression Foundation → Classic Chess/Stockfish → Roster → Skirmish → Battle → Travel Choice → Resources → Settlement → Starvation → Events.

Проверяются 100/415 catalog, 14×6 race distribution + 16 mixed, 3–5 решений, mini-story copy, ~25% Travel distribution, duplicate allowance, shuffle-bag uniqueness, economy idempotency, role gating, четыре explicit King-risk решения, wounded-King continuity, Event→Combat no-double-charge и mobile 390×844.

## Lifecycle

Version: `3.0.0-events.preview.1`.

Текущая ветка: `feature/events`.

Статус до ручного preview acceptance: **IMPLEMENTED → AUTOTESTED pending exact-head Chromium → DEPLOYED pending exact-head Cloudflare → HUMAN ACCEPTED pending**.

Events не переводится в DONE и не merge'ится до успешных exact-head gates и отдельного живого пользовательского playtest.
