# 15 — Save System

## Новая схема
Старые Iron Marches saves не импортируются. Reboot использует собственный локальный namespace `rpchess.reboot.v1.run` и schema version `1`.

## Текущий persistent run
После этапа Resources минимально значимые поля текущего runtime включают:

- `id`, `createdAt`, `updatedAt`;
- `roster`, `selectedCharacterId`;
- `ended`, `endReason`;
- `skirmishCount`, `lastSkirmish`;
- `battleCount`, `lastBattle`;
- `journeyStep`, `currentTravelChoices`, `activeTravelChoice`;
- `gold`, `supplies`;
- `resourceRewards.skirmishCount`, `resourceRewards.battleCount`.

На выбранном пути Resources дополнительно сохраняет `supplyCostAtSelection` и `supplyPaid`, чтобы возобновление уже зафиксированного маршрута не списывало Supplies повторно. Завершённый combat может хранить `goldReward` внутри `lastSkirmish` / `lastBattle`.

## Resources compatibility
Resources v1 сохраняет существующий storage namespace и schema version, поэтому уже созданные Reboot runs не сбрасываются.

Старый Reboot save без новых economy-полей гидратируется так:

- `gold = 80`;
- `supplies = 10`;
- отсутствующие `resourceRewards` инициализируются текущими historical combat counts, чтобы уже завершённые до Resources бои не получили ретроактивную награду.

Gold и Supplies валидируются как неотрицательные целые числа.

## Правило обновлений
При действительно несовместимом dev-изменении допускается сброс сохранений. До релиза приоритет — корректность тестирования, но совместимые добавления должны гидратировать существующий Reboot run без потери статусов фигур и progress counters.

## Позднее
Перед релизом вводятся явные migrations для несовместимых schema changes.
