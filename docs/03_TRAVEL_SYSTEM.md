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
- combat-карточки показывают угрозу по **12-звёздной шкале `★1–12`**;
- при недостатке ширины строка звёзд имеет единственную безопасную точку переноса после шестой звезды, поэтому 12 звёзд могут отображаться как **6 + 6** без горизонтального overflow;
- Settlement показывается как безопасное место без combat threat;
- Event-карточка не раскрывает заранее список решений или отдельный outcome-текст — детали появляются только внутри Event scene;
- **вся карточка является действием выбора**;
- клик сразу фиксирует выбор и запускает соответствующий encounter;
- второго CTA, `Подтвердить`, confirmation modal и отмены после выбора нет;
- `Отряд` можно открыть до выбора пути;
- возврат из Roster и reload до выбора сохраняют **тот же набор из трёх карточек**.

## Необратимость выбора
После клика выбранная карточка сохраняется как `activeTravelChoice`, а текущая тройка очищается. Пока соответствующий encounter не завершён, возврат через Roster или reload возобновляет **уже выбранный encounter**, а не новую развилку.

Skirmish/Battle считаются завершёнными после увеличения соответствующего combat counter. Settlement очищает route при выходе через `Продолжить путь`. Event очищает route после разрешения Event и, если Event запустил combat, после окончания связанного боя.

## Resources + Starvation integration
Каждый **новый committed Travel transition** расходует **1 Supply**.

- стоимость видна на карточке до выбора;
- списание выполняется в той же persistence operation, которая фиксирует `activeTravelChoice`;
- выбранный путь сохраняет `supplyCostAtSelection` и `supplyPaid`;
- возврат через Roster, Event resume или reload не списывает Supply повторно;
- Supplies никогда не уходят ниже нуля;
- если на момент committed transition `supplies = 0`, Starvation детерминированно убивает ровно одну живую персонализированную фигуру до запуска encounter;
- victim id сохраняется до dispatch, поэтому reload не может перебросить жертву;
- если погиб King, run завершается немедленно и encounter не запускается;
- если погиб non-King, после acknowledgement запускается уже выбранный encounter без дополнительного списания Supply.

Gold/Supplies не меняют типы или threat level генерируемой тройки.

## Канонические типы encounter
Полный набор:
- `Puzzle` — шахматная задача;
- `Skirmish` — стычка;
- `Battle` — сражение;
- `Event` — событие;
- `Settlement` — поселение.

### Playable pool текущей Events preview
Реально маршрутизируются:
- `Skirmish`;
- `Battle`;
- `Settlement`;
- `Event`.

`Puzzle` остаётся каноническим типом и имеет label/hint/flavor-content, но **не выдаётся игроку**, пока Puzzle gameplay не реализован. Travel Choice не должен вести в заглушку.

## Генерация текущей версии
Тройка детерминирована по `run.id + journeyStep`, поэтому одинаковое состояние run создаёт одинаковый набор.

Каждая из трёх карточек **независимо** выбирает один из четырёх playable типов через deterministic random stream:

`Skirmish / Battle / Settlement / Event`.

Контракт распределения:
- каждый из четырёх типов имеет долгосрочную вероятность около **25% на каждую карточку**;
- дубликаты допустимы: одна тройка может содержать 2–3 карточки одного типа;
- больше нет гарантии хотя бы одного Skirmish или Battle;
- один и тот же `run.id + journeyStep` всегда воспроизводит ту же тройку;
- разные шаги используют новые deterministic route seeds.

Для каждой карточки рассчитывается:
- отдельный deterministic encounter seed;
- threat stars `1–12`;
- базовая угроза растёт примерно на одну звезду каждые две недели путешествия: `1 + floor((journeyStep - 1) / 2)` с clamp до 12;
- к базовой угрозе применяется deterministic offset `-2…+2`, после чего значение снова clamp'ится в `1…12`;
- world-flavor строка;
- внутренний mechanical hint, используемый как metadata, но не обязанный отображаться на Travel-карточке.

Stars/seed реально передаются в Skirmish/Battle generators. Для combat-route также детерминированно выбираются enemy race theme и сторона игрока. Event использует route seed как часть deterministic Event roll/combat orchestration. Settlement использует route seed для deterministic recruit offers.

## Flavor-content
Для каждого из пяти канонических типов предусмотрен отдельный world-flavor pool. Фраза выбирается детерминированно по route seed. Если в одной тройке несколько карточек одного типа, для них не должна намеренно повторяться одна и та же flavor-фраза, пока pool позволяет выбрать уникальную.

## Persistence
Схема `rpchess.reboot.v1.run` остаётся обратно совместимой и содержит travel state:
- `journeyStep`;
- `currentTravelChoices`;
- `activeTravelChoice`;
- `supplyCostAtSelection`;
- `supplyPaid`;
- Starvation metadata для committed zero-Supply route;
- encounter-specific state (`currentSettlement`, `currentEvent` и combat aftermath metadata).

Старые saves без travel-полей гидратируются безопасными значениями. Уже выбранный route после reload остаётся необратимым.

## Encounter routing
### Skirmish
Travel передаёт route seed/stars, race theme и player color в Skirmish generator. После ordinary aftermath `Продолжить путь` открывает следующую тройку.

### Battle
Travel передаёт route seed/stars, race theme и player color в Battle generator. После ordinary aftermath `Продолжить путь` открывает следующую тройку.

### Settlement
Безопасный encounter: healer, recruitment и supply shop. Вход оплачивается обычным Travel Supply cost. Выход не списывает второй Supply.

### Event
Открывает mini-story scene с 3–5 решениями, deterministic roll и persistent outcome. Event может завершиться мгновенным эффектом или запустить Skirmish/Battle. Переход Event → Combat не списывает второй Supply.

### Puzzle
Пока не входит в playable pool.

## Исторический weighted draft
Ранее в концепции были записаны веса Puzzle 20% / Skirmish 25% / Battle 15% / Event 25% / Settlement 15%. Этот draft **не является текущим production алгоритмом**.

Текущая Events preview использует независимый равновероятный выбор между четырьмя реализованными типами: приблизительно **25/25/25/25**. Puzzle будет добавлен отдельным этапом с новым балансировочным решением.

## Границы Travel System
Travel orchestration отвечает за генерацию тройки, committed route, Supply/Starvation gate и dispatch encounter. Внутренняя логика Skirmish, Battle, Settlement и Event принадлежит соответствующим feature-модулям.

Региональные modifiers, anti-streak rules, Puzzle engine и отдельные weighted encounter tables не входят в текущую Events preview.

## Human Acceptance базового Travel Choice
Базовый Travel Choice был принят пользователем 2026-08-27 и закрыт в `main`.

Accepted gameplay head: `d76fca5ad5e02260a836400c7398158c1657a6f6`.  
Version: `2.6.0-travel-choice.preview.1`.  
Final acceptance push CI `33084047611` / #905: **SUCCESS**.  
Final acceptance PR CI `33084052567` / #906: **SUCCESS**.  
Final exact-head Cloudflare build `b7e9b7dc-9a5c-40aa-b608-6c2c3b438676`: **SUCCESS**; Version `8853fbcc-7e7a-4e49-a83e-c2df68d2f7d5`.  
PR #70 squash-merged в `main` как `ee7d1b348ac88ebafcd334acb84167f6b5a12bdc`.

## Текущий lifecycle
Базовый Travel Choice остаётся **DONE**. Settlement, Resources и Starvation уже расширили его поверх принятого контракта.

Events preview меняет текущий playable pool/generation contract: добавляет `Event`, переводит четыре реализованных типа на независимый равновероятный deterministic pool с разрешёнными дубликатами и расширяет боевую угрозу до 12 уровней. Эта новая Events-часть считается принятой только после exact-head CI/Cloudflare и отдельного живого пользовательского Events playtest.
