# 08 — Events

Events v1 — принятый слой мгновенных фэнтезийных встреч внутри канонического journey loop. Каждое событие открывает отдельную литературную сцену, предлагает несколько решений и разрешается сразу: длинных event chains, политической системы и скрытых многошаговых квестовых веток нет.

## Travel integration

`Event` входит в текущий playable Travel pool наравне с `Skirmish`, `Battle`, `Settlement` и `Puzzle`.

Каждая из трёх карточек Travel Choice независимо получает один из пяти playable типов с равной вероятностью. Поэтому после включения Puzzles долгосрочная доля каждого типа близка к **20%**, а дубликаты одного типа внутри одной тройки допустимы. Отдельной гарантии наличия Skirmish/Battle нет.

Выбор Event-карточки фиксируется как обычный committed transition, расходует обычный `1 Supply` через Resources/Starvation слой и затем маршрутизируется в Events scene. Сам Event не списывает второй Supply.

Исторически Events v1 был принят в четырёхтипном pool ≈25/25/25/25. Этот gameplay contract остаётся частью принятого Events receipt, но текущая journey orchestration после утверждения Puzzles v1 использует five-type pool ≈20/20/20/20/20.

## Каталог v1

Каталог содержит ровно **100 событий / 415 авторских решений**.

Распределение: 14 расовых групп по 6 событий — Люди, Эльфы, Орки, Нежить, Тёмные эльфы, Гномы, Демоны, Ангелы, Дракониды, Зверолюди, Конструкты, Животные, Феи, Гоблины — плюс 16 нейтральных/смешанных событий.

Все 100 событий имеют уникальный `E001…E100`, литературную сцену из нескольких абзацев и **3–5 решений**.

## Выбор следующего события

Events используют deterministic shuffle-bag:
- порядок 100 событий детерминирован по `run.id + cycle`;
- внутри одного цикла каждое событие появляется ровно один раз;
- после исчерпания полного мешка начинается новый детерминированный цикл;
- reload не меняет уже выбранное событие;
- история хранится в persistent run state.

## UX сцены

Event открывается как отдельная полноэкранная сцена в общем frameless UI RPChess.

Игрок видит:
- название события;
- расу/тематику;
- атмосферный иллюстрированный фон;
- литературную сцену из нескольких абзацев, включая реплики;
- 3–5 решений;
- шанс успеха или гарантированный исход;
- role requirement, если решение требует конкретную фигуру;
- стоимость Gold/Supplies, если она есть;
- явные предупреждения о ранении, смерти, начале Skirmish/Battle и риске для Короля.

После выбора итог показывается в отдельном outcome modal, после чего игрок продолжает путь или переходит в связанный combat.

На mobile 390×844 используется vertical flow без горизонтального overflow.

## Event backgrounds

Runtime выбирает фон детерминированно из race-specific pool по `event.id`; нейтральные/смешанные Events используют `generic`.

После live corrections фон больше не зависит от CSS custom-property renderer. `events-app.mjs` создаёт отдельный полноэкранный `<img data-events-background>`, URL явно вычисляется через `new URL(assetPath, document.baseURI).href`, а desktop reading panel ограничен `min(980px, 68vw)`, чтобы значительная часть иллюстрации оставалась открытой.

Пользователь подтвердил 2026-08-29, что фоновые изображения Событий видны в live preview.

### Canonical asset register

Утверждённый `event_backgrounds.md` задаёт активную библиотеку ровно **36 PNG 16:9**: 8 generic backgrounds + 14 race pools по 2 изображения.

Канонический набор полностью присутствует в репозитории и напрямую используется runtime. В частности:
- Animals: `animals/wild_glen.png`, `animals/riverbank_tracks.png`;
- Fae: `fae/fae_ring_garden.png`, `fae/whispering_meadow.png`;
- Goblins: `goblins/goblin_trade_nook.png`, `goblins/goblin_scrapyard_camp.png`.

`tests/events.cjs` и source verification требуют наличие всех 36 канонических файлов и совпадение runtime pools с реестром. Старые fallback/альтернативные имена больше не используются активным runtime.

Дополнительные Merfolk backgrounds могут оставаться упакованными как будущий контент, но не входят в активный 14-race Events v1 contract и не считаются частью канонических 36.

## Role-gated решения

Некоторые варианты требуют здорового персонализированного героя роли `Pawn`, `Knight`, `Bishop`, `Rook` или `Queen`. Если подходящего героя нет, решение disabled и показывает причину.

## Проверка исхода

Для выбранного решения выполняется deterministic roll `1–100`, привязанный к run, route seed, event и choice id.

- `roll <= chance` — успех;
- иначе — неудача;
- гарантированные решения используют 100%;
- resolved Event не может быть повторно брошен или применён после reload.

Сохраняются `choiceId`, `roll`, success/failure, итоговые notes и возможный combat outcome.

## Возможные эффекты

Поддерживаются Gold/Supplies gain/loss/cost, recruit, wound/death случайной non-King фигуры, wound/death выбранного role hero, wound King, explicit King-risk death, запуск `Skirmish` или `Battle` с модификатором угрозы и no-effect outcomes.

Экономика idempotent: цена и награда применяются один раз и не дублируются после reload/resume.

## Recruitment

`recruit` выбирает детерминированного доступного non-King героя из существующей recruitment library, исключая уже находящихся в roster. Если свободных рекрутов нет, используется безопасный fallback `+18 Gold`.

## Ранения и смерть

Обычные случайные death/wound эффекты **никогда не выбирают King**.

В каталоге v1 ровно **4 решения**, которые действительно могут убить King. Каждое имеет `kingRisk=true`, явное UI-предупреждение и при смерти King немедленно завершает run.

Wounded King остаётся обязательным и combat-eligible в последующих Skirmish/Battle, чтобы не возникал softlock.

## Event → Combat

Event создаёт combat override с типом боя, stars с clamp **1–12**, deterministic seed, race/mixed theme, deterministic player color (`w`/`b`) и enemy role-race map.

Если игрок получает чёрных, белый противник начинает первым. Event→Combat **не списывает дополнительный Supply**. После завершения боя orchestration возвращает игрока в обычный journey loop.

## Combat visual contract

Общая шкала сложности Skirmish/Battle — **12 уровней Stockfish 400…2600 Elo**.

Human temporary pieces используют `assets/races/humans/pieces/white/` и `black/`; race themes используют соответствующие PNG по шахматной роли; mixed encounters могут брать разные роли из разных race sets.

Combat-art continuity сохраняет race/custom ассеты при ререндере доски. Рокировка переносит visual identity ладьи для обеих сторон. Для **неименной временной пешки** promotion немедленно заменяет pawn art на выбранный `queen / rook / bishop / knight` и сохраняет новый арт на последующих ходах. Именной персонаж сохраняет персональный identity-art.

Пользователь подтвердил в live preview корректную рокировку без смены ассета и корректную смену ассета при promotion неименной пешки.

## Persistence

Events используют `rpchess.reboot.v1.run` и сохраняют `eventHistory`, `currentEvent`, committed route, choice/roll/outcome и возможный Event combat state.

Persistence умеет восстанавливать старые stale combat transients после завершённой Skirmish/Battle. Event-карточки с намеренно пустым `mechanicalHint` валидны. Stars persistence поддерживает весь диапазон `1–12`.

## Gates

Канонический deploy gate: `npm run gate:local` = source verification → полный deterministic Node suite → production build. `tests/events-visual.cjs` входит в canonical `npm test` и проверяет explicit backdrop contract. `tests/combat-art-continuity.cjs` проверяет обе рокировки, все четыре promotion choices и post-promotion continuity. `tests/events.cjs` дополнительно проверяет полный канонический реестр 36 Event backgrounds и регрессию текущего five-type Travel distribution.

Standalone `npm run gate:full` дополнительно содержит real-Chromium regression. GitHub Actions используется как ручная диагностика, а не обязательный deploy gate.

## Human acceptance

Пользователь завершил live retest 2026-08-29 и подтвердил: **«всё хорошо и все работает»**.

Подтверждено в живой сборке:
- aftermath → Travel → Event transitions;
- видимые Event backgrounds;
- opponent castling без смены race-specific rook asset;
- promotion неименной пешки со сменой ассета на выбранную фигуру.

Accepted gameplay head: `5347db734a82639f41188e74874ebee4a15540ea`.

Accepted version: `3.0.0-events.preview.6`.

Accepted Cloudflare build: `4c5013dc-7e28-41a4-aa01-8684a21c3f8d` — **SUCCESS**.

Accepted Cloudflare Version: `56865d3e-18b0-4868-8329-5171cd016ec2`.

Accepted preview: `https://56865d3e-rpchess.mobigametim.workers.dev`.

## Production closure

Acceptance-docs exact head `1b39988a4deeffb88edd379343b5f69ea86f82db` прошёл Cloudflare build `4bc864ec-93dc-4800-aa3f-c87ba8b2098c` — **SUCCESS**, Version `31dac392-6d39-4d85-9d56-26a8b218de3e`.

Из-за ошибки GitHub connector Ready mutation (`fullDatabaseId`) исходный Draft PR #76 был закрыт без merge; тот же exact tree был открыт как non-Draft PR #77 и squash-merged без изменений gameplay tree.

Events production merge SHA: `1e47a4a3121f1156a623a98ae29866b3a07d4cbc`.

Post-merge Cloudflare build: `5f137e48-7b8a-42e1-830e-c7826fa8f11a` — **SUCCESS**; Version `45dcd46b-1306-4249-ae14-f48b5cd4b492`.

## Lifecycle

Events остаётся **IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DOCS SYNCED → DONE**.

Текущий следующий feature — **Puzzles v1**. Его UX/spec утверждён 2026-08-29, реализация активна в `feature/puzzles`, а merge заблокирован до canonical gate, Cloudflare preview и отдельного human acceptance.
