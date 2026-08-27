# 06 — Battle

Battle — полноценная классическая партия с полным стандартным комплектом фигур у обеих сторон: **16 фигур / 39 очков + King стоимостью 0**. В отличие от Skirmish игрок не конструирует нестандартную армию: он решает, какие персонализированные персонажи заменят временные стандартные фигуры соответствующего типа.

## Утверждённый UX
- всегда существует стандартный комплект: 1 King, 1 Queen, 2 Rook, 2 Bishop, 2 Knight, 8 Pawn;
- состав типов и размер армии изменить нельзя;
- персонализированный King обязателен и не может быть заменён generic King;
- HEALTHY персонализированные фигуры по умолчанию выбраны, пока хватает слотов их типа;
- игрок может снять любого именного участника кроме King; освободившийся слот автоматически занимает временная generic-фигура того же типа;
- wounded/dead остаются видимыми, но не могут участвовать;
- при избытке персонализированных фигур одного типа одновременно участвует не больше стандартного количества слотов: Queen 1, Rook 2, Bishop 2, Knight 2, Pawn 8;
- если слот типа заполнен, попытка добавить следующего персонажа блокируется понятным сообщением;
- справа показывается реальный preview стандартных 1–2 горизонталей: personal `pieceArt` на выбранных слотах и стандартные battle assets на временных слотах;
- ручной drag-and-drop и ручной выбор конкретной стартовой клетки в v1 отсутствуют;
- одинаковый набор участников всегда занимает одинаковые слоты в стабильном roster order;
- action bar показывает количество именных участников, `16 ФИГУР`, `39 ОЧКОВ` и CTA `Начать битву`.

## Вход через Travel Choice
Battle больше не использует временный прямой bridge из Roster. Игрок попадает в Battle preparation после выбора карточки типа `БИТВА` в Travel Choice.

Travel Choice передаёт Battle deterministic route seed и выбранную угрозу `★1–5`. Battle использует их для выбора утверждённого encounter tier / Stockfish Elo, поэтому информация на карточке пути соответствует реально запущенному encounter.

Если игрок после выбора Battle возвращается в Roster или перезагружает страницу до завершения encounter, решение не отменяется: `Начать путешествие` снова возобновляет этот же выбранный Battle.

## Стартовая позиция
Battle всегда использует каноническую стартовую FEN:

`rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1`

То есть сохраняются стандартные права рокировки. После `Начать битву` используется существующий `ClassicChessEngine` + Stockfish; отдельного Battle chess engine нет.

## Персонализированные фигуры
- выбранный персонаж заменяет standard slot только того же `pieceType`;
- персонализированный `pieceArt` отображается непосредственно на доске;
- identity следует за фигурой при ходе и удаляется при взятии;
- move/capture presentation сохраняет personalized art;
- generic-фигуры полностью временные и их потери не сохраняются;
- шахматная сила named и generic фигуры одного типа одинакова: никаких способностей, стат-бонусов или специальных ходов нет.

## Участие
Battle сохраняет `participants` — список именных персонажей, которые реально вышли на поле. В v1 участие не даёт временных Gold/XP/стат-бонусов. Поле предназначено для будущих Rewards, Events, relationship/history progression и achievements.

## Promotion персонализированной Pawn
Если персонализированная Pawn достигает последней горизонтали, она остаётся тем же персонажем, а её **текущий шахматный тип внутри партии** становится выбранной promoted-фигурой. Technical chess marker меняется вместе с состоянием Classic Chess engine, personalized art остаётся. После завершения Battle permanent `pieceType` персонажа в Roster остаётся `pawn`.

## Последствия
- взятая generic-фигура не имеет persistence;
- взятая персонализированная non-King фигура получает `wounded / ТЯЖЕЛО РАНЕН`;
- ничья не убивает King, но взятые named non-King всё равно остаются wounded;
- **мат игроку = персонализированный King получает `dead` = run ended = `endReason=king_dead`**;
- мат противнику = победа Battle.

## Aftermath
После победы или ничьей показываются только судьбы персонализированных участников: `ПОБЕДА` или `НИЧЬЯ`, `Выжили`, `Тяжело ранены`. Generic casualties не перечисляются. Блока `Погибли` нет. Мат игроку открывает отдельный `ЗАБЕГ ЗАВЕРШЁН / КОРОЛЬ ПОГИБ`.

В обычном не-финальном aftermath CTA — **`Продолжить путь`**. Он завершает активный Travel Choice encounter и открывает новую тройку путей.

## Persistence
Схема `rpchess.reboot.v1.run` остаётся обратно совместимой и содержит `battleCount`, `lastBattle`, `lastBattle.participants` и outcome metadata. Travel Choice отдельно хранит активный выбранный маршрут и считает Battle завершённым только после увеличения `battleCount`.

## Mobile
Full-army preview и выбранные именные участники идут перед каталогом; action bar sticky; только vertical scroll; horizontal overflow запрещён.

## Границы Battle v1
Не входят: ручная расстановка, изменение 39-point army, способности, equipment modifiers, special objectives, fog of war, другие размеры доски, permanent promotion, persistence generic casualties, Resources, Settlement.

Travel Choice уже является внешней orchestration-системой Battle, но не изменяет его шахматные правила или roster consequences.

## Human Acceptance
Пользователь завершил живой Battle playtest 2026-08-27 и подтвердил: **«все хорошо»**.

Accepted gameplay head: `40f234740783699b564dc53db7783d36d5ae5e7f`.
Accepted version: `2.5.0-battle.preview.1`.
Accepted GitHub Actions push run: `33073454223` / #891 — **SUCCESS**, включая source verification, deterministic tests, production build, clean distribution boundary и полный real Chromium regression-suite Foundation → Classic Chess → Stockfish → Roster → Skirmish → Battle.
Accepted Cloudflare build: `855b8d21-3dbf-42e2-9dac-3646c2061d41` — **SUCCESS**; Version `9ba31509-3bf7-4853-b7af-ac77a9664f85`.
Accepted preview: `https://9ba31509-rpchess.mobigametim.workers.dev`.
Battle squash-merged в `main`; current accepted Battle lifecycle: **IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DONE**.
