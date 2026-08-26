# 17 — Tech Architecture

## Целевое разделение
- `src/chess/` — rules, position, notation, AI, puzzles.
- `src/run/` — travel, encounters, generator, resources.
- `src/roster/` — characters, army, injuries.
- `src/content/` — characters, races, events, puzzles, settlements.
- `src/persistence/`, `src/ui/`, `assets/`.

## Критический контракт
Chess layer ничего не знает о gold, supplies, events или campaign. Он получает позицию/ход и возвращает legality, position, check, mate, draw.

## Разработка
Каждая feature: ТЗ → DoD → feature branch → tests → CI → preview → human playtest → fixes → acceptance → GitHub docs + Notion → merge.
