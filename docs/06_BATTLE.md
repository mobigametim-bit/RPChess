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
- одинаковый набор участников всегда занимает одинаковые слоты в stable roster order;
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

## Battle Mercenaries Economy — accepted extension 2026-08-31

Стандартные неименные фигуры Battle называются **Наёмники** и автоматически занимают все незаполненные named-слоты полного классического состава.

Базовая стоимость одного Наёмника при реальной нехватке именной фигуры:
- Pawn — **1 Gold**;
- Knight — **3 Gold**;
- Bishop — **3 Gold**;
- Rook — **5 Gold**;
- Queen — **9 Gold**;
- King в системе Наёмников не участвует.

Для стартового roster/default selection требуется 10 Наёмников общей стоимостью **26 Gold**.

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

Acceptance receipt исходного Mercenaries extension:
- Human acceptance: **«всё хорошо» — 2026-08-31**;
- accepted exact head: `f2c3c92b3636b593cca97c662be6b8c3f1a692c9`;
- Cloudflare exact-head build `d431ac63-54ec-4757-9be3-16aefc9d0cf4` — **SUCCESS**;
- Draft PR #92 закрыт unmerged только из-за GitHub GraphQL `fullDatabaseId` при Draft → Ready;
- идентичный non-Draft PR #93 squash-merged в production `main` как `33f602b4b8644a9c7612ba18033c4ad0e9ee5941`;
- GitHub Actions не использовались.

Исходный lifecycle расширения: **IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DOCS SYNCED → DONE**.

## Balance Gate override — healthy reserve pricing

Во время Balance Gate 2026-08-31 найден exploit: здоровых именных героев можно было сознательно снять с Battle и заменить дешёвыми Наёмниками, полностью избегая риска ранения roster.

Утверждённый anti-exploit contract сохраняет свободу deselect, но различает **реальную нехватку состава** и **добровольную замену здорового героя**.

Если здоровый именной герой подходящего типа есть в roster, но оставлен в резерве, каждый Наёмник, реально занимающий его освободившийся standard slot, стоит не меньше healing cost этого типа. В текущем Balance Pass 1 replacement prices равны healing costs:
- Pawn — **10 Gold**;
- Knight — **18 Gold**;
- Bishop — **18 Gold**;
- Rook — **26 Gold**;
- Queen — **42 Gold**.

Правило применяется поштучно. Если Battle требует две Rook, у игрока есть только одна healthy named Rook и она снята с выбора, одна Rook-наёмник стоит 26 Gold, а вторая закрывает реальную нехватку и стоит обычные 5 Gold.

`wounded` и `dead` не считаются здоровым резервом. Если соответствующего healthy героя нет, используется обычная цена 1/3/3/5/9.

Контрольные примеры для стартового roster:
- default selection → 10 Наёмников / **26 Gold**;
- только King → 15 Наёмников / **108 Gold**;
- если одна стартовая Pawn wounded и выбран только King → **99 Gold**.

Battle preparation теперь текстом объясняет: `Свободный слот — дешёвый Наёмник. Замена оставленного в резерве здорового героя стоит как его лечение.`

Balance Gate Pass 1 acceptance receipt:
- runtime commit `689bdeec1754425e5f61b75535e06ed6fb119d4d`;
- regression/gameplay candidate `46a33ffc10110bd89134bfa8fe86f026945bc4ed`;
- gameplay Cloudflare build `b5bf6322-3e6b-4410-8e21-32a0b0d0a3f2` — **SUCCESS**;
- accepted exact head `de819f0aebc0bebf6898bf8d4d26ce172a4b408f`;
- accepted exact-head Cloudflare build `23be38ab-5524-47eb-97d5-5ff92c6d39d8` — **SUCCESS**;
- Human acceptance: **«да, отлично, всё хорошо» — 2026-08-31**;
- GitHub Actions не используются.

## Persistence
Схема `rpchess.reboot.v1.run` остаётся обратно совместимой и содержит `battleCount`, `lastBattle`, `lastBattle.participants` и outcome metadata. Mercenaries extension добавляет transient `battleMercenaryContract` между `Начать битву` и её settlement; после завершения контракт очищается, а receipt переносится в `lastBattle`. Balance Gate добавляет в transient contract breakdown `baseMercenaryCounts` / `reserveReplacementCounts`, не меняя version persistence schema.

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