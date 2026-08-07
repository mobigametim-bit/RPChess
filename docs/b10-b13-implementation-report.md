# B10–B13 — production implementation report

Дата: 7 августа 2026.

## Итог

Этапы 0–3 после B9 реализованы в production runtime Железных Маршей. Полный GitHub Actions CI проходит `verify`, `content:validate`, весь `npm test`, browser build и проверку distribution entry.

## Этап 0 — закрытие B9 / B12 / B13 runtime gaps

- сохранён B9 generator/save contract и поуровневая материализация;
- добавлены player-facing controls форсированного марша с обязательным выбором последствия;
- добавлены немедленный opaque secret decision, active-secret completion и бесплатный возврат;
- добавлен player-facing rare reopen для authored закрытых ветвей;
- будущая topology по-прежнему не передаётся presenter;
- canonical event reservation lifecycle переведён на `available / reserved / completed`;
- legacy `released` мигрируется в `available`;
- chain `chain.iron_marches.honor` мигрируется в `chain.iron_marches.honor_of_the_marches`.

## Этап 1 — B10 экономика и сервисы

- начало production-акта: 10 припасов и 80 золота + explicit gold start modifiers;
- обычные стартовые бонусы не увеличивают припасы;
- три фиксируемых предложения награды: power, 3 припаса, 30/50/70 золота;
- дополнительная цель добавляет authored +1 припас или +10 золота;
- generation награды не зависит от текущих ресурсов и состояния армии;
- append-only economy ledger;
- фиксированные price bands 20–30 / 40–60 / 70–100 / 110–140;
- магазин: четыре сохранённые позиции, без reroll, несколько одноразовых покупок;
- госпиталь: 25 / 50 / 60 / 90;
- кузница: только реликвии, 50 / 80 / 30 / 60, deterministic pre-generated reforge result;
- лагерь: ровно одно бесплатное действие;
- blocked service offers показывают причину и итоговый остаток золота;
- межактовая конвертация: весь остаток припасов ×5 в золото, следующий акт — 10 припасов;
- browser persistence test подтверждает атомарную покупку и точный reload витрины/ledger;
- статистический corpus: 10 500 актов по семи стратегиям; balanced median route cost 10, supplies replenishment 4, gold income 100, soft-lock 0.

## Этап 2 — B11 narrative facts и политика

- типы фактов: fate, position, obligation, knowledge, relation, control;
- хранятся source, scope, visibility, event class, priority, replaceability и compatibility key;
- immutable decision history отделена от currentFacts;
- конфликт разрешается по приоритету regional finale > key > standard > small;
- равный класс заменяется только внутри authored compatibility group;
- отдельные состояния линий `iron_and_bread` и `honor_of_the_marches`;
- participant selection helper: linked character → unique hero → king → doctrine;
- политический финал Железных Маршей строится из фактов, может открывать дополнительные исходы, менять цену и сторонников;
- при любом поддерживаемом состоянии остаётся хотя бы один доступный исход;
- финальный исход выбирает игрок; автоматического выбора нет;
- выбранный финал становится campaign-scope fate fact.

## Этап 3 — B12/B13 production closure

- семь production-ready событий: 3 small / 3 standard / 1 key;
- две цепочки и standalone/favorable/crisis варианты продолжений;
- hidden недоступные choices не попадают в player-facing view;
- бинарные вероятности суммируются в 100%; максимум два положительных и один отрицательный модификатор;
- exact percentages, modifier source/value, participant, immediate preview и event journal доступны presenter/UI;
- многоэтапная event session сохраняет stage, RNG state, resources, flags и combat state;
- reload не reroll-ит outcome;
- event combats используют `event_only` reward mode и не запускают стандартную тройку наград;
- Register 04 отделён от authored runtime: 74 изображения импортированы, но только семь Железных Маршей считаются production-ready событиями;
- остальные asset-only записи не выдаются игроку как пустые события.

## Автоматические проверки

В полном CI выполняются:

- B9 generator/distribution/reload tests;
- B10 unit economy contracts;
- B10 10 500-act economy simulation;
- B10 browser start-resource contract;
- B10 atomic shop persistence/reload;
- B11 typed-fact, priority, participant and political-finale tests;
- B12/B13 seven-event closure, variants, hidden options, modifier caps, no-reroll and event-combat tests;
- B10–B13 static browser UI command/disclosure contract;
- все legacy/regression tests;
- `npm run verify`;
- `npm run content:validate`;
- `npm run build`.

## Ограничение acceptance

Автоматический browser/runtime acceptance включён в CI. Ручной визуальный проход desktop/mobile остаётся отдельной QA-проверкой: текущий toolchain не предоставляет интерактивный браузер для ручного клика по PR preview. Его нельзя отмечать как выполненный без фактического человеческого прогона. Это не оставляет runtime-заглушек, но сохраняет честный QA-флаг в Roadmap.
