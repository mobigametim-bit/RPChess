# 03 — Travel System

## Путешествие без заранее построенной карты
RPChess не использует заранее собранную campaign map. После старта путешествия и после каждого завершённого не-финального encounter игрок получает **ровно три карточки следующего пути**.

Текущий production flow:

`Отряд → Начать путешествие → Travel Choice → encounter → aftermath → Продолжить путь → новый Travel Choice`.

Если персонализированный King погибает, run завершается и новый Travel Choice не создаётся.

## UX Travel Choice
- отдельная полноэкранная сцена;
- desktop: три карточки пути рядом;
- mobile: три карточки вертикально, только vertical scroll, без horizontal overflow/carousel;
- каждая карточка показывает тип encounter, угрозу `★1–5`, короткую world-flavor фразу, механический hint и текущую стоимость перехода;
- **вся карточка является действием выбора**;
- клик сразу фиксирует выбор и запускает соответствующий encounter;
- второй CTA, `Подтвердить`, confirmation modal и возможность отмены после выбора отсутствуют;
- кнопка `Отряд` позволяет открыть Roster до выбора пути;
- возврат из Roster показывает **тот же набор из трёх карточек**;
- reload страницы до выбора также восстанавливает тот же набор.

## Необратимость выбора
После клика выбранная карточка сохраняется как `activeTravelChoice`, а текущий набор карточек очищается. Пока соответствующий encounter не завершён, возврат через Roster или reload снова открывает **уже выбранный encounter**, а не новую развилку.

Выбор считается завершённым только когда увеличился счётчик соответствующего combat encounter (`skirmishCount` или `battleCount`). После обычного aftermath `Продолжить путь` создаёт следующую тройку.

## Resources integration
После реализации Resources каждый **новый committed transition** расходует **1 Supply**.

- стоимость видна на карточке до выбора;
- списание выполняется в той же persistence operation, которая фиксирует `activeTravelChoice`;
- выбранный путь сохраняет `supplyCostAtSelection` и `supplyPaid`;
- возврат через Roster или reload не списывает Supply повторно;
- Supplies никогда не уходят ниже нуля;
- при `supplies = 0` переход пока остаётся доступным и записывает `supplyPaid = 0`; фактическая случайная гибель персонализированной фигуры вводится только на отдельном roadmap-этапе **Starvation**.

Текущие Gold/Supplies не меняют генерацию, состав или threat level тройки.

## Типы encounter
Полный канонический набор типов:
- `Puzzle` — шахматная задача;
- `Skirmish` — стычка;
- `Battle` — сражение;
- `Event` — событие;
- `Settlement` — поселение.

### Playable pool текущей версии
Сейчас реально маршрутизируются только:
- `Skirmish`;
- `Battle`.

`Event`, `Settlement` и `Puzzle` уже имеют labels, hints и flavor-content в Travel content layer, но **не выдаются игроку**, пока соответствующие gameplay feature не реализованы. Travel Choice не должен отправлять игрока в заглушку.

## Генерация v1
Тройка детерминирована по `run.id + journeyStep`, поэтому одинаковое состояние run создаёт одинаковый набор.

Для текущего playable pool:
- в тройке гарантированно присутствует хотя бы один `Skirmish` и один `Battle`;
- третий тип выбирается детерминированно между playable типами;
- базовая угроза растёт по мере путешествия: `1 + floor((step - 1) / 2)`, clamp `1–5`;
- три карточки получают перемешанные offsets угрозы `-1 / 0 / +1`, также с clamp `1–5`;
- каждая карточка получает отдельный deterministic encounter seed;
- этот seed и выбранное количество звёзд передаются в существующий Skirmish/Battle generator и реально определяют encounter difficulty.

## Flavor-content
Для каждого из пяти канонических типов предусмотрено минимум **12 уникальных world-flavor фраз**. Фраза выбирается детерминированно по route seed. Если в одной тройке две карточки одного типа, они не получают одинаковую flavor-фразу.

## Persistence
Схема `rpchess.reboot.v1.run` содержит:
- `journeyStep`;
- `currentTravelChoices`;
- `activeTravelChoice`;
- после Resources на committed route: `supplyCostAtSelection`, `supplyPaid`.

Старые saves без travel-полей гидратируются безопасными значениями: `journeyStep=0`, `currentTravelChoices=null`, `activeTravelChoice=null`.

## Aftermath integration
Обычный Skirmish/Battle aftermath использует CTA `Продолжить путь`. Travel orchestration очищает завершённый `activeTravelChoice` и открывает следующую развилку. King-death run end остаётся отдельным финальным экраном и не маршрутизируется обратно в Travel Choice.

## Стартовые веса из design draft
Ранее в концепции были записаны веса Puzzle 20%, Skirmish 25%, Battle 15%, Event 25%, Settlement 15%. Это **future Encounter Generator draft**, а не активный алгоритм Travel Choice v1. Веса будут отдельно реализованы и сбалансированы, когда все пять типов станут playable.

## Границы Travel Choice
Сам Travel Choice не реализует starvation casualty, healing/recruitment/shop economy, Event resolution, Puzzle engine, полноценные weighted encounter tables, anti-streak rules и региональные модификаторы генерации. Supply cost подключён поверх принятого Travel Choice через Resources и не меняет его deterministic routing contract.

## Human Acceptance Travel Choice
Пользователь завершил живой Travel Choice playtest 2026-08-27 и подтвердил: **«всё хорошо»**.

Accepted gameplay head: `d76fca5ad5e02260a836400c7398158c1657a6f6`.  
Accepted docs-synchronized preview head before acceptance commit: `7775750690b5a9e2a947baf5d9091b3b898a6241`.  
Version: `2.6.0-travel-choice.preview.1`.  
Gameplay GitHub Actions `33080571104` / #898: **SUCCESS**.  
Pre-acceptance docs-head GitHub Actions `33081722542` / #903: **SUCCESS**.  
Accepted Cloudflare build `e5b0d01e-433c-44f7-81b9-df10a2127e23`: **SUCCESS**; Version `7047b3fb-ffc9-4e69-88cb-39566293ec66`.  
Accepted preview: `https://7047b3fb-rpchess.mobigametim.workers.dev`.

## Статус Travel Choice
**IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DONE**. Travel Choice merged to `main` as `ee7d1b348ac88ebafcd334acb84167f6b5a12bdc`. Resources extends travel with economy persistence without reopening the accepted Travel Choice feature.
