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

## Same-schema hydration
Resources v1 сохраняет существующий storage namespace и schema version. Поддерживаемый Reboot v1 state гидратируется best-effort; это не создаёт обязательства поддерживать несовместимые или более старые schema.

Старый Reboot save без новых economy-полей гидратируется так:

- `gold = 80`;
- `supplies = 10`;
- отсутствующие `resourceRewards` инициализируются текущими historical combat counts, чтобы уже завершённые до Resources бои не получили ретроактивную награду.

Gold и Supplies валидируются как неотрицательные целые числа.

## Правило обновлений
При несовместимом изменении schema сохранение безопасно сбрасывается. Совместимые additions внутри текущей schema могут гидратироваться без потери основных статусов и counters, но сохранение старых/несовместимых dev-saves не является release contract.

## Граница совместимости
Iron Marches saves не импортируются. Явная migration добавляется только тогда, когда она будет отдельно утверждена как продуктовая обязанность; по умолчанию unsupported schema reset остаётся каноническим поведением.
