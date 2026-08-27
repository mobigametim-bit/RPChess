# RPChess Reboot Changelog

## 2026-08-27 — Resources HUMAN ACCEPTED
- Пользователь завершил живой Resources playtest и подтвердил: **«все работает, золото начисляется, припасы тратятся»**.
- Human Gate Resources закрыт: начисление Gold после боя и расход Supplies на Travel подтверждены в live preview.
- Accepted gameplay head: `e162c347efe7ec1e55c1f76df7999c90469f1906`.
- Version: `2.7.0-resources.preview.1`.
- Accepted Cloudflare build `34063395-1b82-44b2-b93c-caef6f4c0e5f`: **SUCCESS**; Version `da19ea4e-60ef-467a-85e4-5137a2e76c15`; preview `https://da19ea4e-rpchess.mobigametim.workers.dev`.
- Последующий commit `44766f3e5e0bd6fa98684ada50ce19fb043e8c6a` исправляет только область Chromium assertion и не меняет gameplay/runtime.
- Статус: **IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED**; DONE наступает только после финального docs-synchronized exact-head CI/Cloudflare, Ready/merge PR #71 и post-merge verification `main`.
- Settlement не начинается до полного closure Resources.

## 2026-08-27 — Travel Choice HUMAN ACCEPTED → DONE
- Пользователь завершил живой Travel Choice playtest и подтвердил: **«всё хорошо»**.
- Travel Choice закрыт как **IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DONE**.
- Подтверждены: ровно 3 route cards; мгновенный необратимый выбор карточки без второго CTA; persistence набора через Roster/reload; возобновление уже выбранного encounter вместо повторного выбора; корректная маршрутизация Skirmish/Battle; `Продолжить путь` после ordinary aftermath; mobile vertical flow без horizontal overflow.
- Accepted gameplay head: `d76fca5ad5e02260a836400c7398158c1657a6f6`.
- Accepted docs-synchronized preview head before acceptance commit: `7775750690b5a9e2a947baf5d9091b3b898a6241`.
- Version: `2.6.0-travel-choice.preview.1`.
- Gameplay GitHub Actions `33080571104` / #898: **SUCCESS**, включая полный real Chromium regression-suite Foundation → Classic Chess → Stockfish → Roster → Skirmish → Battle → Travel Choice.
- Pre-acceptance docs-head GitHub Actions `33081722542` / #903: **SUCCESS**, включая полный real Chromium regression-suite.
- Accepted Cloudflare build `e5b0d01e-433c-44f7-81b9-df10a2127e23`: **SUCCESS**; Version `7047b3fb-ffc9-4e69-88cb-39566293ec66`; preview `https://7047b3fb-rpchess.mobigametim.workers.dev`.
- PR #70 остаётся unmerged только до финального acceptance-docs exact-head CI/Cloudflare gate. Resources не начинается до post-merge closure `main`.

## 2026-08-27 — Travel Choice implementation ready for human playtest
- Реализована каноническая петля `Отряд → Travel Choice → encounter → aftermath → Продолжить путь → следующий Travel Choice`.
- `Начать путешествие` теперь открывает отдельную сцену с **ровно 3** карточками; временный прямой Battle shortcut удалён.
- Клик по карточке сразу и необратимо фиксирует путь и запускает encounter; отдельного confirm/second CTA нет.
- Набор карточек детерминирован по `run.id + journeyStep`, сохраняется в `rpchess.reboot.v1.run` и не меняется после Roster/reload.
- После уже сделанного выбора Roster/reload возобновляют тот же encounter, а не дают выбрать заново.
- Текущий playable pool — `Skirmish + Battle`; `Event / Settlement / Puzzle` уже имеют labels/hints и по 12 flavor-фраз, но не генерируются до реализации соответствующего gameplay.
- Для всех пяти канонических типов добавлено по **12 уникальных world-flavor фраз**; одинаковые типы внутри одной тройки не получают одинаковый текст.
- Threat `★1–5` и route seed реально передаются в существующие Skirmish/Battle generators; Battle/Skirmish aftermath использует `Продолжить путь`.
- Добавлены deterministic tests, persistence migration checks и отдельный desktop/mobile real-Chromium Travel Choice acceptance; весь старый regression-suite сохранён.
- Gameplay head: `d76fca5ad5e02260a836400c7398158c1657a6f6`.
- Version: `2.6.0-travel-choice.preview.1`.
- GitHub Actions run `33080571104` / #898: **SUCCESS**, включая source verify, deterministic tests, production build, clean distribution boundary и full real Chromium Foundation → Classic Chess → Stockfish → Roster → Skirmish → Battle → Travel Choice.
- Cloudflare gameplay build `0550b45c-ca7c-4104-8907-fafc2dda0b13`: **SUCCESS**; Version `48116a6f-9290-4108-8166-0b9ab5d4cb7c`.
- Gameplay preview: `https://48116a6f-rpchess.mobigametim.workers.dev`; alias: `https://feature-travel-choice-rpchess.mobigametim.workers.dev`.
- Статус: **IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED pending**. Resources не начинается и Travel Choice не merge-ится до живого подтверждения пользователя.

## 2026-08-27 — Battle HUMAN ACCEPTED → DONE
- Пользователь завершил живой Battle playtest и подтвердил: **«все хорошо»**.
- Battle закрыт как **IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DONE**.
- Подтверждены стандартная армия 16 фигур / 39 очков + обязательный King стоимостью 0, автоматическая замена standard slots персонализированными HEALTHY фигурами своего типа, generic replacement при снятии named-участника, personalized `pieceArt` и identity на шахматной доске, persistence `participants / battleCount / lastBattle`, ранения captured named non-King и отдельный King-death run end.
- Accepted gameplay head: `40f234740783699b564dc53db7783d36d5ae5e7f`.
- Accepted version: `2.5.0-battle.preview.1`.
- GitHub Actions push run `33073454223` / #891: **SUCCESS**, включая source verification, deterministic tests, production build, clean distribution boundary и full real Chromium regression-suite Foundation → Classic Chess → Stockfish → Roster → Skirmish → Battle.
- Cloudflare accepted build `855b8d21-3dbf-42e2-9dac-3646c2061d41`: **SUCCESS**; Version `9ba31509-3bf7-4853-b7af-ac77a9664f85`.
- Accepted preview: `https://9ba31509-rpchess.mobigametim.workers.dev`.
- Следующий этап — **Travel Choice**, только после merge Battle PR и успешной post-merge проверки `main`.

## 2026-08-27 — Skirmish HUMAN ACCEPTED → DONE
- Пользователь завершил повторный живой тест исправленного Skirmish preview и подтвердил: **«всё хорошо»**.
- Skirmish закрыт как **IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DONE**.
- Подтверждены personalized `pieceArt` на шахматной доске и сохранение identity после хода, ordinary aftermath без блока `Погибли`, отдельный run-ending экран `ЗАБЕГ ЗАВЕРШЁН / КОРОЛЬ ПОГИБ` и отсутствие регрессий в ранее принятом Skirmish flow.
- Accepted corrected gameplay head: `b11f712e63366a70f35c0de8fd0b823159dad0cd`.
- Accepted docs-synchronized preview head: `40b093eeb601097afe9fa0da0990594a8fcc2ffc`.
- Accepted version: `2.4.0-skirmish.preview.2`.
- GitHub Actions push run `33068848497` / #882: **SUCCESS**, включая full real Chromium acceptance.
- GitHub Actions PR run `33069287273` / #883: **SUCCESS** на том же exact head.
- Cloudflare accepted build `f575d3d6-d62f-48bc-907d-4873e67ac154`: **SUCCESS**; Version `0727f70c-24a7-4dbc-aa1f-6559f968fd1e`.
- Accepted preview: `https://0727f70c-rpchess.mobigametim.workers.dev`.
- Следующий этап — **Battle**, только после merge PR #68 и успешной post-merge проверки `main`.

## 2026-08-27 — Skirmish corrections implemented for Gate C retest
- Пользователь завершил первый живой Skirmish playtest и подтвердил, что основной режим работает; осталось два точечных замечания.
- В обычном aftermath удалён блок `Погибли`: не-King персонализированные фигуры после взятия получают `ТЯЖЕЛО РАНЕН`, а не погибают.
- Мат игроку больше не использует обычный aftermath: смерть персонализированного King открывает отдельный run-end summary `ЗАБЕГ ЗАВЕРШЁН / КОРОЛЬ ПОГИБ` с краткими итогами забега и возвратом в главное меню.
- Персонализированные фигуры игрока теперь используют на самой шахматной доске собственный `pieceArt` из Roster (`oathkeeper/piece.png`, hero `piece_badge.png`), а не стандартные `unit_*_player.png`.
- Piece identity следует за фигурой при перемещении; персональный art сохраняется также в move/capture presentation. Безымянные/вражеские фигуры остаются на стандартных battle assets.
- Corrected gameplay head: `b11f712e63366a70f35c0de8fd0b823159dad0cd`.
- GitHub Actions run `33068231777` / #878: **SUCCESS**, включая source/static/core tests, build/distribution и real Chromium Foundation + Classic Chess + Stockfish + Roster + исправленный Skirmish flow.
- Cloudflare gameplay build `d357a056-1850-407d-9421-76b151c062e8`: **SUCCESS**; Version `e8815edb-0617-43de-8449-f7f09cbbcea8`; gameplay preview `https://e8815edb-rpchess.mobigametim.workers.dev`.
- Версия исправленного preview поднята до `2.4.0-skirmish.preview.2`; финальный docs-only exact-head gate выполняется перед повторным human test.
- Статус: **IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED pending**. Battle не начинается и Skirmish не merge-ится до повторного подтверждения пользователя.

## 2026-08-27 — Roster HUMAN ACCEPTED → DONE
- Пользователь завершил повторный живой тест исправленного Roster preview и подтвердил: **«всё хорошо»**.
- Roster закрыт как **IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DONE**.
- Accepted gameplay head: `21486014ca110062fdcb776d5119b23dbe3418cf`.
- Accepted version: `2.3.0-roster.preview.3`.
- GitHub Actions exact-head run `33059487594`: **SUCCESS**, включая source/static/persistence checks, production build, real Chromium Foundation, Classic Chess, Stockfish и полный Roster journey flow.
- Cloudflare accepted gameplay build `7f7d60f8-ce9c-4b8b-8680-3bc80e4fe33a`: **SUCCESS**; Version `78461dc1-d43a-4392-ae01-f04af95a70e2`.
- Accepted preview: `https://78461dc1-rpchess.mobigametim.workers.dev`.
- Проверены финальные live corrections: новая мини-история Хранителя Клятвы, отсутствие служебных healthy/king фраз и рабочий маршрут `Продолжить → Отряд → Начать путешествие → выбор партии → Начать партию → шахматная доска`.
- `docs/04_ROSTER.md` проверен и остаётся актуальной спецификацией; Roadmap переведён на Roster `DONE`.
- Следующий этап — **только UX-проектирование Skirmish**. Реализация Skirmish не начинается до отдельного обсуждения и явного утверждения UX пользователем.

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