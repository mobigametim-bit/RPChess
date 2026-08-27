# RPChess Reboot Changelog

## 2026-08-27 — Global framed-content safe-area invariant
- После финального UI spot-check пользователь подтвердил весь Chess AI polish и добавил одно обязательное правило для **всей игры**: текст и интерактивные элементы во всех декоративных фреймах должны оставаться внутри внутренней рабочей области и визуально не касаться рамки.
- В `reboot-foundation.css` введён централизованный `--ui-frame-safe-*` contract и reusable `.ui-frame-safe` utility для текущих и будущих сцен.
- `.reboot-modal__panel` и `.classic-panel` подключены к этому контракту глобально.
- Левый safe-area inset намеренно больше правого, чтобы текст не стоял вплотную к декоративной кромке.
- Добавлены ограничения `min-width: 0`, `max-width: 100%` и безопасный перенос длинного текста внутри framed surfaces.
- Mobile получает отдельные компактные, но ненулевые safe-area значения.
- Cache-bust Foundation stylesheet поднят до `20260827-reboot-4`.
- Preview version поднята до `2.2.0-chess-ai.preview.4`.
- `16_UI_UX.md` закрепляет правило как game-wide invariant для всех последующих feature.
- Reboot Foundation static contract теперь проверяет наличие safe-area variables, reusable utility, binding текущих panel families и отдельный левый inset.

## 2026-08-27 — Chess AI final UI polish corrections
- После второго live spot-check пользователь подтвердил всё, кроме пяти UI-компоновочных замечаний.
- Technical role glyph уменьшен, окружность/подложка убрана, glyph перенесён в крайний левый верхний угол клетки; white side использует белый glyph, black side — чёрный.
- Увеличена safe-area padding внутри commander-style рамок, чтобы текст и элементы оставались в тёмной области и не пересекались с декоративной рамкой.
- Широкая status-плашка `Партия завершена…` удалена из визуальной композиции.
- Duplicate post-game `Новая партия / Главное меню` внутри панели `Партия` удалены; верхний toolbar остаётся единственным action set.
- Desktop-layout изменён на `Партия` слева / доска по центру / `Ходы` справа.
- SAN/figurines, captured material, smooth movement и blue CTA сохранены без изменения.
- Версия поднята до `2.2.0-chess-ai.preview.3`.
- Static contract усилен на final layout, marker style, hidden status plaque и отсутствие duplicate post-game CTA.

## 2026-08-27 — Chess AI gameplay test passed; production polish implemented
- Пользователь подтвердил, что Chess AI gameplay и все основные пункты теста работают корректно.
- Перед финальным acceptance запросил production polish интерфейса партии.
- На каждую fantasy-фигуру добавлен технический шахматный marker в верхнем левом углу.
- История переведена на стандартную SAN-запись с figurine rendering для фигур; поддерживаются capture `x`, check `+`, mate `#`, castling, promotion и disambiguation.
- Добавлены технические glyph взятых фигур и material advantage.
- Большая центральная плашка `Компьютер думает…` убрана из визуального слоя; AI turn остаётся в status line.
- Ходы фигур получили плавную 230ms-анимацию с отдельным capture fade; reduced-motion отключает переходы.
- Панели и модальные окна переведены на тёмный approved commander-selection treatment: `ui_panel_frame.png` + `#091524` + inner keyline вместо светлой parchment-подложки.
- Все action-кнопки используют синий `ui_button_primary.png`; light/secondary action frame в polish layer не используется.
- Версия поднята до `2.2.0-chess-ai.preview.2`.
- Static/source/build и Chromium contracts расширены на markers, SAN/figurines, captured material, animation, commander surfaces и blue CTA.

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

## 2026-08-26 — Classic Chess human playtest passed; scene switching corrected
- Пользователь подтвердил успешное прохождение всех запрошенных пунктов Classic Chess playtest: board interaction, legal move highlighting, turn flow, castling, en passant, promotion, check/mate, settings/audio, menu controls и mobile/narrow viewport.
- Единственный найденный defect был presentation-level: после `Новая игра` главное меню оставалось в layout, поэтому шахматная сцена появлялась ниже него вместо полноценной смены сцены.
- Root cause: author CSS `.reboot-menu-screen { display: grid; }` перекрывал браузерное отображение HTML `hidden` для menu root.
- Исправлен общий scene visibility contract: `[data-reboot-foundation][hidden]` и `[data-classic-screen][hidden]` принудительно удаляются из layout через `display: none !important`.
- Обновлён cache-busting query для Foundation stylesheet.
- Усилены static и Chromium regression tests.

## 2026-08-26 — Classic Chess preview ready for human playtest
- Реализован standalone Classic Chess runtime без загрузки gameplay-кода Iron Marches.
- Реализованы обычные ходы, шах, мат, пат, рокировка, en passant, promotion Q/R/B/N, правило 50 ходов, троекратное повторение и недостаточный материал.
- Canonical engine acceptance: стартовая позиция perft(3) = 8902; Kiwipete = 48 / 2039 / 97862; canonical endgame perft(3) = 2812.

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
