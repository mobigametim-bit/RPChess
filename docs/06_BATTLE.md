# 06 — Battle

Battle — полноценная классическая партия с полным стандартным комплектом фигур у обеих сторон: **16 фигур / 39 очков + King стоимостью 0**. В отличие от Skirmish игрок не конструирует нестандартную армию: он решает, какие персонализированные персонажи заменят Наёмников соответствующего типа.

## Утверждённый UX
- всегда существует стандартный комплект: 1 King, 1 Queen, 2 Rook, 2 Bishop, 2 Knight, 8 Pawn;
- состав типов и размер армии изменить нельзя;
- персонализированный King обязателен и не может быть заменён generic King;
- HEALTHY персонализированные фигуры по умолчанию выбраны, пока хватает слотов их типа;
- игрок может снять любого именного участника кроме King; освободившийся слот автоматически занимает Наёмник того же типа;
- wounded/dead остаются видимыми, но не могут участвовать;
- при избытке персонализированных фигур одного типа одновременно участвует не больше стандартного количества слотов: Queen 1, Rook 2, Bishop 2, Knight 2, Pawn 8;
- если слот типа заполнен, попытка добавить следующего персонажа блокируется понятным сообщением;
- справа показывается реальный preview стандартных 1–2 горизонталей: personal `pieceArt` на выбранных слотах и стандартные battle assets на слотах Наёмников;
- ручной drag-and-drop и ручной выбор конкретной стартовой клетки в v1 отсутствуют;
- одинаковый набор участников всегда занимает одинаковые слоты в стабильном roster order;
- action bar показывает количество именных участников, `16 ФИГУР`, `39 ОЧКОВ` и CTA `Начать битву`.

## Вход через Travel Choice
Battle больше не использует временный прямой bridge из Roster. Игрок попадает в Battle preparation после выбора карточки типа `БИТВА` в Travel Choice.

Travel Choice передаёт Battle deterministic route seed и выбранную угрозу. Battle использует их для выбора утверждённого encounter tier / Stockfish Elo, поэтому информация на карточке пути соответствует реально запущенному encounter.

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
- Наёмники существуют только в рамках текущей Battle; их шахматные потери отдельно не сохраняются;
- шахматная сила named и Наёмника одного типа одинакова: никаких способностей, стат-бонусов или специальных ходов нет.

## Участие
Battle сохраняет `participants` — список именных персонажей, которые реально вышли на поле. Поле предназначено для Rewards, Events, relationship/history progression и achievements.

## Promotion персонализированной Pawn
Если персонализированная Pawn достигает последней горизонтали, она остаётся тем же персонажем, а её **текущий шахматный тип внутри партии** становится выбранной promoted-фигурой. Technical chess marker меняется вместе с состоянием Classic Chess engine, personalized art остаётся. После завершения Battle permanent `pieceType` персонажа в Roster остаётся `pawn`.

## Последствия
- взятый Наёмник не имеет отдельного casualty persistence;
- взятая персонализированная non-King фигура получает `wounded / ТЯЖЕЛО РАНЕН`;
- ничья не лечит уже полученные тяжёлые ранения;
- обычный шахматный checkmate сам по себе не является RPG-смертью named non-King героя;
- результат Battle сохраняется в `lastBattle` и возвращает игрока в journey loop, если run не завершён отдельной RPG-причиной.

## Aftermath
После Battle показываются судьбы персонализированных участников: `ПОБЕДА`, `ПОРАЖЕНИЕ` или `НИЧЬЯ`, выжившие и тяжело раненые. Наёмники как отдельные casualties не перечисляются.

В обычном не-финальном aftermath CTA — **`Продолжить путь`**. Он завершает активный Travel Choice encounter и открывает новую тройку путей.

## Battle Mercenaries Economy — approved extension 2026-08-31

Стандартные неименные фигуры Battle называются **Наёмники** и автоматически занимают все незаполненные named-слоты полного классического состава.

Стоимость одного Наёмника:
- Pawn — **1 Gold**;
- Knight — **3 Gold**;
- Bishop — **3 Gold**;
- Rook — **5 Gold**;
- Queen — **9 Gold**;
- King в системе Наёмников не участвует.

Стоимость зависит только от фактически незаполненных named-слотов при нажатии `Начать битву`. Для стартового roster/default selection требуется 10 Наёмников общей стоимостью **26 Gold**.

Оплата происходит автоматически и атомарно при единственном клике `Начать битву`:
1. сначала списывается доступное Gold;
2. оставшаяся стоимость покрывается Supplies по курсу **1 Supply = 10 Gold**; количество Supplies округляется вверх до целой единицы;
3. если Gold + Supplies всё равно недостаточно, списываются все доступные для этой оплаты ресурсы и создаётся один persistent `casualtyDebt`, независимо от размера неоплаченного остатка.

На Battle preparation нет дополнительного warning/confirm. После перехода на шахматную доску существующий верхний resource-toast показывает фактическое списание Gold/Supplies. При `casualtyDebt` тот же toast сообщает: после Battle погибнет один герой.

После завершения именно этой Battle долг разрешается один раз:
- погибает ровно один **named non-King** герой;
- сначала выбираются `wounded / ТЯЖЕЛО РАНЕН`, если такие есть;
- иначе выбирается `healthy`;
- `dead` и King исключены;
- стоимость и шахматный тип героя не влияют на выбор;
- среди равных кандидатов выбор deterministic;
- если run уже завершён смертью King/другой terminal RPG-причиной, дополнительная casualty не применяется.

Payment/debt idempotent и persistent. Reload или повторное открытие той же Battle не могут вернуть списанные ресурсы, уменьшить уже зафиксированную стоимость или снять casualty debt. Итоговый payment receipt и возможная casualty записываются в `lastBattle`.

Текущий статус расширения: **UX/SPEC APPROVED → IMPLEMENTED IN `deploy` → AUTOTEST / CLOUDFLARE / HUMAN ACCEPTANCE PENDING**.

## Persistence
Схема `rpchess.reboot.v1.run` остаётся обратно совместимой и содержит `battleCount`, `lastBattle`, `lastBattle.participants` и outcome metadata. Mercenaries extension добавляет transient `battleMercenaryContract` между `Начать битву` и её settlement; после завершения контракт очищается, а receipt переносится в `lastBattle`.

## Mobile
Full-army preview и выбранные именные участники идут перед каталогом; action bar sticky; только vertical scroll; horizontal overflow запрещён.

## Границы Battle v1
Не входят: ручная расстановка, изменение 39-point army, способности, equipment modifiers, special objectives, fog of war, другие размеры доски и permanent promotion. Mercenaries Economy является отдельным принятым расширением поверх Battle v1 и не меняет шахматные правила.

## Human Acceptance — historical Battle v1
Пользователь завершил живой Battle v1 playtest 2026-08-27 и подтвердил: **«все хорошо»**.

Accepted gameplay head: `40f234740783699b564dc53db7783d36d5ae5e7f`.
Accepted version: `2.5.0-battle.preview.1`.
Accepted Cloudflare build: `855b8d21-3dbf-42e2-9dac-3646c2061d41` — **SUCCESS**; Version `9ba31509-3bf7-4853-b7af-ac77a9664f85`.
Accepted preview: `https://9ba31509-rpchess.mobigametim.workers.dev`.
Battle v1 squash-merged в `main`; historical lifecycle: **IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DONE**.

Для текущего проекта GitHub Actions не используются.
