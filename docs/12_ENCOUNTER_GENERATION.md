# 12 — Encounter Generation

## Генератор следующих путей
Вход: `runDepth`, `roster`, `supplies`, `gold`, `previousEncounters`, `seed`.

Выход: ровно три карточки с полями `type`, `difficulty`, `title`, `description`, `rewardHint`, `visual`, `seed`.

## Стычка
Вход дополнительно учитывает `playerArmyPoints`, `playerPieceCount`, `playerComposition`.

Выход: `enemyArmy`, `enemyArmyPoints`, `enemyElo`, `enemyRace`.

## Принцип сложности
Сила встречи = сочетание шахматной силы AI и материальной силы армии; генератор не обязан зеркалить состав игрока.
