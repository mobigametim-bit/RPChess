# RPChess Reboot Changelog

## 2026-08-27 — Game-wide ornate panel-frame removal
- После Roster preview пользователь утвердил новое постоянное правило: декоративные panel-frame assets больше не используются ни в одной active Reboot сцене и не должны использоваться в будущих feature.
- `ui_panel_frame.png` и `ui_panel_wide.png` удалены из активных CSS references Foundation, Classic Chess, Chess AI polish и Roster.
- Модалки, `Партия`, `Ходы`, Roster detail/catalog и внешняя обкладка шахматной доски переведены на CSS-only frameless surfaces: тёмная подложка, тонкая синяя/сдержанная золотистая граница и мягкая тень.
- Введён новый глобальный `--ui-panel-*` visual contract и `--ui-panel-safe-*` / `.ui-panel-safe` safe-area contract.
- Левый safe inset остаётся немного больше правого; текст и интерактивные элементы не касаются внешней границы surface.
- Approved blue CTA `ui_button_primary.png` сохранён; запрет касается panel-frame assets, а не кнопок.
- Static/source verification теперь считает любое возвращение `ui_panel_frame.png` / `ui_panel_wide.png` в active Reboot CSS регрессией.
- Все active CSS получили новый cache-bust `20260827-frameless-1`.
- Roster preview version поднята до `2.3.0-roster.preview.2`.
- Skirmish по-прежнему заблокирован до финального живого Roster acceptance.

## 2026-08-27 — Roster implementation ready for human playtest
- Пользователь утвердил UX Roster и все предложенные решения: отдельная сцена `Отряд`, автоматический стартовый Король, memorial `Погибшие`, классическая стоимость фигур и локальное сохранение run.
- `Новая игра` теперь создаёт persistent Reboot run и открывает `Отряд` отдельной сценой вместо standalone chess setup.
- `Продолжить` становится рабочей кнопкой после создания run и восстанавливает текущий roster после reload.
- Стартовый отряд состоит из 6 персонализированных фигур: Хранитель Клятвы, Альдрик Стена, Мара Цепь, Немея Перо, Брат Орелл и Ваэль Молот.
- Состав стартовых ролей: King + 2 Pawn + Knight + Bishop + Rook = 13 классических командных очков + обязательный King. Queen оставлен как будущий ценный recruit.
- Используются реальные legacy/current repository assets: portrait для detail и piece/piece_badge для карточек; новые изображения для этой feature не генерировались.
- Добавлены состояния `healthy / wounded / dead`, фильтры `Все / Здоровы / Ранены / Погибшие` и memorial поведение: погибший персонаж остаётся в истории текущего забега.
- Roster намеренно не содержит checkbox, `Применить состав`, лимиты `16/16` или `39/39`, drag-and-drop, стартовые клетки и `В ПУТЬ`; эти задачи принадлежат будущим Skirmish/Travel feature.
- Добавлены `roster-data.mjs`, `run-persistence.mjs`, `roster-app.mjs`, `roster.css`, deterministic persistence/static tests и real-Chromium Roster acceptance.
- Начальная preview version: `2.3.0-roster.preview.1`.
- Skirmish заблокирован до живого **HUMAN ACCEPTED → DONE** Roster preview.

## 2026-08-27 — Chess AI HUMAN ACCEPTED → DONE
- Пользователь подтвердил финальный UI spot-check без дополнительных gameplay замечаний.
- Chess AI закрыт как **IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DONE**.
- Accepted preview: `2.2.0-chess-ai.preview.4`; accepted gameplay/UI head: `556423dd31778def0d6245a4de1d221dc5a2299c`.
- GitHub Actions run `33026697784`, job `98369639263`: **SUCCESS**, включая real Chromium + Stockfish acceptance.
- Cloudflare build `af7b2919-b1c2-44a4-be56-167453070c99`: **SUCCESS**; Version `7bf7d0e6-1cbb-4e91-8203-7b66319e7e14`.
- Следующий этап: Roster.

## 2026-08-27 — Chess AI final UI polish corrections
- Technical role glyph уменьшен, окружность/подложка убрана, glyph перенесён в крайний левый верхний угол клетки; white side использует белый glyph, black side — чёрный.
- Широкая status-плашка `Партия завершена…` удалена из визуальной композиции.
- Duplicate post-game `Новая партия / Главное меню` внутри панели `Партия` удалены; верхний toolbar остаётся единственным action set.
- Desktop-layout изменён на `Партия` слева / доска по центру / `Ходы` справа.
- SAN/figurines, captured material, smooth movement и blue CTA сохранены без изменения.
- Версия поднята до `2.2.0-chess-ai.preview.3`.

## 2026-08-27 — Chess AI gameplay test passed; production polish implemented
- Пользователь подтвердил, что Chess AI gameplay и все основные пункты теста работают корректно.
- На каждую fantasy-фигуру добавлен технический шахматный marker в верхнем левом углу.
- История переведена на стандартную SAN-запись с figurine rendering для фигур; поддерживаются capture `x`, check `+`, mate `#`, castling, promotion и disambiguation.
- Добавлены технические glyph взятых фигур и material advantage.
- Большая центральная плашка `Компьютер думает…` убрана из визуального слоя; AI turn остаётся в status line.
- Ходы фигур получили плавную 230ms-анимацию с отдельным capture fade; reduced-motion отключает переходы.
- Все action-кнопки используют синий `ui_button_primary.png`.
- Версия поднята до `2.2.0-chess-ai.preview.2`.

## 2026-08-26 — Chess AI implementation ready for deployment gate
- После merge принятого Classic Chess создана `feature/chess-ai` от exact `main` commit `6df1a65ffca36413d99415eab1f0e5ccddbd5dbe`.
- Добавлен `ChessAIAdapter`; игровой runtime не зависит напрямую от Stockfish implementation.
- Выбран Stockfish.js / Stockfish 18 lite single-threaded Web Worker + WASM.
- Build pipeline загружает закреплённые release binaries Stockfish 18.0.0, проверяет SHA-256 и поставляет GPLv3 `COPYING.txt` + `SOURCE.txt`.
- Добавлены 12 уровней сложности от ≈400 до ≈2600 Elo.
- Для 400–1200 используется MultiPV + контролируемый выбор слабых/случайных легальных ходов; для 1400+ — `UCI_LimitStrength` / `UCI_Elo`.
- Добавлено production-ready окно новой партии: компьютер/локально, Elo, белые/чёрные/случайно.
- При игре за чёрных доска разворачивается, Stockfish автоматически делает первый ход.
- Во время AI turn доска блокируется; после расчёта управление возвращается игроку.
- Сохранён локальный режим двух игроков и все ранее принятые classical rules.
- Добавлены deterministic adapter tests и real-Stockfish Chromium acceptance contract.
- Cloudflare build gate усилен: перед deploy выполняется `npm test && npm run build`.
- Preview version: `2.2.0-chess-ai.preview.1`; human acceptance pending.

## 2026-08-26 — Classic Chess HUMAN ACCEPTED → DONE
- Пользователь успешно завершил полный Classic Chess playtest.
- После исправления scene-switch дефекта пользователь отдельно подтвердил финальный spot-check: `Новая игра` полностью заменяет главное меню шахматной сценой, а `Главное меню` полностью возвращает menu scene.
- Classic Chess закрыт как **HUMAN ACCEPTED → DONE**.
- Финальный accepted feature version: `2.1.0-classic-chess`.
- Classic Chess squash merge: `6df1a65ffca36413d99415eab1f0e5ccddbd5dbe`.

## 2026-08-26 — Reboot Foundation human accepted
- Reboot Foundation принят после живого preview-теста.
- Главное меню возвращено к production-ready композиции предыдущей RPChess.
- Восстановлен реальный музыкальный слой и UI SFX.
- Сохранён глобальный vertical-scroll contract.
- Foundation version: `2.0.0-foundation.2`.

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
