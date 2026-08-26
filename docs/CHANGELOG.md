# RPChess Reboot Changelog

## 2026-08-26 — Classic Chess preview ready for human playtest
- Реализован новый standalone Classic Chess runtime без загрузки gameplay-кода Iron Marches.
- `Новая игра` запускает полноценную локальную партию на классической доске 8×8 с production-ассетами 12 стандартных фигур.
- Реализованы обычные ходы, шах, мат, пат, рокировка, взятие на проходе, обязательное превращение в Q/R/B/N, запрет оставлять собственного короля под шахом, правило 50 ходов, троекратное повторение и недостаточный материал.
- Добавлены production board states: выбор фигуры, legal/capture targets, последний ход, шах, история ходов и финальные состояния партии.
- Сохранены музыка, UI/game SFX, настройки и responsive/vertical-scroll contract.
- Canonical engine acceptance: стартовая позиция perft(3) = 8902; Kiwipete = 48 / 2039 / 97862 на глубинах 1/2/3; canonical endgame perft(3) = 2812.
- Cloudflare exact-head build проходит production build/source/distribution verification.
- Real Chromium desktop/mobile acceptance suite добавлен в CI, но GitHub Actions runner сейчас завершается до первого workflow step; hosted Chromium execution поэтому остаётся инфраструктурно заблокированным и не помечается как пройденный.
- Preview version: `2.1.0-classic-chess.preview.2`.
- PR #65 остаётся Draft до живого HUMAN PLAYTEST. Chess AI до принятия этого gate не начинается.

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
