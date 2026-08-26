# RPChess Reboot Changelog

## 2026-08-26 — Reboot Foundation human accepted
- Reboot Foundation принят после живого preview-теста.
- Главное меню возвращено к production-ready композиции предыдущей RPChess; исключены только системы, которых ещё нет в Reboot.
- Удалён prototype/dev explanatory copy из основного игрового экрана.
- Восстановлен реальный музыкальный слой на четырёх существующих треках и UI SFX с управлением через настройки.
- Сохранён глобальный vertical-scroll contract для узких и низких viewport.
- `Продолжить` остаётся отключён до появления Reboot save-flow; `Новая игра` не загружает legacy gameplay.
- Foundation version: `2.0.0-foundation.2`.
- Cloudflare production build текущего Foundation head успешно проходит; GitHub Actions runner остаётся отдельной инфраструктурной проблемой (job завершается до первого step).

## 2026-08-26 — Reboot approved
- Утверждён полный перезапуск gameplay при сохранении текущего UI и ассетов.
- Зафиксированы классические шахматы 8×8 без спецспособностей.
- Зафиксированы режимы Puzzle, Skirmish, Battle, Event, Settlement.
- Карта заменена бесконечной цепочкой выбора 1 из 3 случайных следующих путей.
- Skirmish: обязательный персонализированный King, максимум 16 фигур, максимум 39 очков, автоматическая стартовая расстановка.
- Gold и Supplies — единственные ресурсы первой версии.
- При переходе без припасов случайная персонализированная фигура погибает; смерть King завершает run.
- Метапрогрессия отложена.
- Введён feature-by-feature workflow с обязательным human playtest.
- Iron Marches v1 зафиксирован в `archive/iron-marches-v1` на `035fb817a93f53047a1d20f7cdfc9093b0f7d611`.
