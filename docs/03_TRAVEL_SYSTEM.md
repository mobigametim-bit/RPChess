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
- каждая карточка показывает тип encounter, угрозу `★1–5`, короткую world-flavor фразу и механический hint;
- **вся карточка является действием выбора**;
- клик сразу фиксирует выбор и запускает соответствующий encounter;
- второй CTA, `Подтвердить`, confirmation modal и возможность отмены после выбора отсутствуют;
- кнопка `Отряд` позволяет открыть Roster до выбора пути;
- возврат из Roster показывает **тот же набор из трёх карточек**;
- reload страницы до выбора также восстанавливает тот же набор.

## Необратимость выбора
После клика выбранная карточка сохраняется как `activeTravelChoice`, а текущий набор карточек очищается. Пока соответствующий encounter не завершён, возврат через Roster или reload снова открывает **уже выбранный encounter**, а не новую развилку.

Выбор считается завершённым только когда увеличился счётчик соответствующего combat encounter (`skirmishCount` или `battleCount`). После обычного aftermath `Продолжить путь` создаёт следующую тройку.

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
Для каждого из пяти канонических типов предусмотрено минимум **12 уникальных world-flavor фраз**:
- Skirmish — 12;
- Battle — 12;
- Event — 12;
- Settlement — 12;
- Puzzle — 12.

Фраза выбирается детерминированно по route seed. Если в одной тройке две карточки одного типа, они не получают одинаковую flavor-фразу.

## Persistence
Схема `rpchess.reboot.v1.run` остаётся обратно совместимой и содержит:
- `journeyStep`;
- `currentTravelChoices`;
- `activeTravelChoice`.

Старые saves без этих полей гидратируются безопасными значениями: `journeyStep=0`, `currentTravelChoices=null`, `activeTravelChoice=null`.

## Aftermath integration
Обычный Skirmish/Battle aftermath использует CTA `Продолжить путь`. Travel orchestration очищает завершённый `activeTravelChoice` и открывает следующую развилку.

King-death run end остаётся отдельным финальным экраном и не маршрутизируется обратно в Travel Choice.

## Стартовые веса из design draft
Ранее в концепции были записаны веса:
- Puzzle 20%;
- Skirmish 25%;
- Battle 15%;
- Event 25%;
- Settlement 15%.

Это **future Encounter Generator draft**, а не активный алгоритм Travel Choice v1. Веса будут отдельно реализованы и сбалансированы, когда все пять типов станут playable.

## Границы Travel Choice v1
Не входят: Gold/Supplies cost, starvation, healing/recruitment/shop economy, Event resolution, Puzzle engine, полноценные weighted encounter tables, anti-streak rules и региональные модификаторы генерации.

## Human Acceptance
Пользователь завершил живой Travel Choice playtest 2026-08-27 и подтвердил: **«всё хорошо»**.

Подтверждены: три route cards, мгновенный выбор карточки без второго CTA, persistence набора через Roster/reload, необратимость уже выбранного пути, корректная маршрутизация Skirmish/Battle, `Продолжить путь` после ordinary aftermath и mobile vertical flow.

Accepted gameplay head: `d76fca5ad5e02260a836400c7398158c1657a6f6`.
Accepted docs-synchronized preview head before acceptance commit: `7775750690b5a9e2a947baf5d9091b3b898a6241`.
Version: `2.6.0-travel-choice.preview.1`.
Gameplay GitHub Actions `33080571104` / #898: **SUCCESS**, включая полный real Chromium regression-suite.
Pre-acceptance docs-head GitHub Actions `33081722542` / #903: **SUCCESS**, включая полный real Chromium regression-suite.
Accepted Cloudflare build `e5b0d01e-433c-44f7-81b9-df10a2127e23`: **SUCCESS**; Version `7047b3fb-ffc9-4e69-88cb-39566293ec66`.
Accepted preview: `https://7047b3fb-rpchess.mobigametim.workers.dev`.
Alias: `https://feature-travel-choice-rpchess.mobigametim.workers.dev`.

## Статус реализации
Feature branch: `feature/travel-choice`.
Статус: **IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DONE**.
PR #70 остаётся unmerged до финального acceptance-docs exact-head CI/Cloudflare gate; после зелёного gate выполняется squash merge и post-merge проверка `main`.
