# B11 — аудит REGISTER_04_EVENTS и production runtime

Дата: 7 августа 2026.

`content/manifests/register-04-events.json` содержит 74 импортированных иллюстрации. На текущем production-срезе полностью авторизованы и подключены семь событий Железных Маршей; остальные 67 записей остаются контентным резервом будущих регионов, generic/political/hero/secret пулов и не выдаются как готовые production-события.

## Железные Марши

| Register | Asset slug | Production ID | Класс | Статус |
| --- | --- | --- | --- | --- |
| EVENT-003 | `miners_on_strike` | `event.miners_on_strike` | key | authored + runtime |
| EVENT-005 | `cracked_bell` | `event.cracked_bell` | small | authored + runtime |
| EVENT-007 | `prisoners_of_the_pass` | `event.prisoners_pass` | standard | authored + runtime |
| EVENT-008 | `empty_armory` | `event.empty_armory` | small | authored + runtime |
| EVENT-009 | `duel_of_masons` | `event.duel_masons` | small | authored + runtime |
| EVENT-010 | `furnace_oath` | `event.furnace_oath` | standard | authored + runtime |
| EVENT-012 | `disputed_standard` | `event.disputed_standard` | standard | authored + runtime |

Разница между asset slug и runtime ID у `prisoners_of_the_pass` / `event.prisoners_pass` и `duel_of_masons` / `event.duel_masons` является явным mapping, а не дублем события.

## Цепочки

Production selector использует канонические идентификаторы:

- `chain.iron_marches.iron_and_bread`;
- `chain.iron_marches.honor_of_the_marches`.

Старый ID `chain.iron_marches.honor` принимается только как migration alias и нормализуется в `honor_of_the_marches` в selector state schema 2.

## Lifecycle

Selector state schema 2 использует только:

- `available` — материализация была освобождена после закрытия ветви и может снова попасть в пул;
- `reserved` — событие закреплено за материализованным узлом;
- `completed` — событие завершено и исключено до конца акта.

Legacy `released` мигрируется в `available` при загрузке.

## Asset-only записи

Остальные 67 иллюстраций не считаются production-ready событиями только по факту наличия картинки. Для них ещё потребуются authored scenes, choices, requirements, outcome packages, typed facts, phase/weight contracts и tests в соответствующих региональных этапах. Это исключает случайную выдачу иллюстрации как пустого события.
