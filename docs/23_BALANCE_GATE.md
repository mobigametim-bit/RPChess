# 23 — Balance Gate

## Статус

**PASS 1 — IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → MERGED → DOCS SYNCED → DONE. PASS 2 — IMPLEMENTED → REGRESSION UPDATED → CLOUDFLARE GATE SUCCESS → HUMAN PLAYTEST PENDING.**

Balance Gate не добавляет новую шахматную механику. Цель — свести уже существующие Gold / Supplies / Settlement / Battle Mercenaries / Puzzle rewards / Power-Threat в один экономически связный контракт и затем проверять его контролируемыми balance-pass, меняя только диагностически обоснованные ручки.

## Текущий production baseline

### Старт
- Gold: **80**
- Supplies: **10**
- новый committed Travel: **1 Supply**

### Награды
- Skirmish victory: `12 + 4 × stars` → **16…60 Gold** на ★1…★12
- Battle victory до Pass 2: `20 + 6 × stars` → **26…92 Gold** на ★1…★12
- draw: половина соответствующей victory-награды
- Puzzle perfect: `9 + 3 × stars` → **12…45 Gold**; ошибки дают 70% / 40% / 0%

### Settlement — baseline до Balance Gate
Healing:
- Pawn 10
- Knight 18
- Bishop 18
- Rook 26
- Queen 42

Recruitment:
- Pawn 24
- Knight 42
- Bishop 42
- Rook 64
- Queen 96

Supplies:
- 1 Supply = **12 Gold**
- stock = **4**

### Battle Mercenaries — baseline
- Pawn 1 / Knight 3 / Bishop 3 / Rook 5 / Queen 9 Gold
- Supply fallback value: **1 Supply = 10 Gold**
- полный generic non-King комплект стоит **39 Gold**
- со стартовым roster/default selection добор Battle стоит **26 Gold**

### Power / Threat
- starting Power: **500**
- K-factor: **32**
- base threat: `floor((Power - 400) / 200) + 1`, clamp ★1…★12
- adaptive route offset: +0 / +1 / +2 / +3 с вероятностями **40% / 30% / 20% / 10%**
- при Power 500 обычный боевой/Puzzle route получает ★1…★4 с распределением 40/30/20/10

## История Pass 1

Первый вариант Pass 1 поднимал healing до 20/36/36/52/84 и recruitment до 72/126/126/192/288. После первого preview пользователь изменил направление: **лечение откатить к baseline, стоимость найма снизить на 30% от текущего Pass 1**.

Затем при ручной проверке был найден отдельный Battle exploit: игрок может снять всех здоровых именных героев, оставить только King и купить дешёвую generic-армию, полностью избегая риска ранения roster. Пользователь утвердил anti-exploit правило: **Наёмник, заменяющий сознательно оставленного в резерве здорового именного героя, должен стоить не меньше лечения героя того же типа.**

## Balance Pass 1 — принятый production contract

### Settlement healing
- Pawn **10**
- Knight **18**
- Bishop **18**
- Rook **26**
- Queen **42**

### Settlement recruitment
- Pawn **50**
- Knight **88**
- Bishop **88**
- Rook **134**
- Queen **202**

### Battle Mercenaries — healthy reserve pricing
Свобода выбора состава сохраняется: игрок может снять любого здорового именного героя кроме King.

Базовая цена при реальной нехватке состава:
- Pawn **1 Gold**
- Knight **3 Gold**
- Bishop **3 Gold**
- Rook **5 Gold**
- Queen **9 Gold**

Если healthy именной герой соответствующего типа есть в roster, но не выбран, Наёмник, реально занимающий его освободившийся standard slot, стоит как лечение этого типа:
- Pawn **10 Gold**
- Knight **18 Gold**
- Bishop **18 Gold**
- Rook **26 Gold**
- Queen **42 Gold**.

Правило считается поштучно. Wounded/dead не создают premium; отсутствие героя также оставляет базовую цену. King системой Наёмников не заменяется.

Контрольные точки:
- стартовый roster/default selection: **10 Наёмников / 26 Gold**;
- `King only` со стартовым healthy roster: **15 Наёмников / 108 Gold**;
- если одна стартовая Pawn wounded, King-only quote = **99 Gold**.

## Замороженные ручки Pass 1

Без изменений:
- старт 80 Gold / 10 Supplies;
- Travel = 1 Supply;
- Supply shop = 12 Gold, stock 4;
- Skirmish/Battle rewards;
- Puzzle rewards;
- базовые Battle Mercenary costs и fallback 10 Gold per Supply;
- Power 500, K=32, star/Elo table и adaptive offset;
- Event economy/content.

## Regression — Pass 1

Settlement regression закрепляет полный `HEAL_COSTS` / `RECRUIT_COSTS`, включая Queen 42 / 202, и фактическое списание 10 Gold за лечение Pawn.

Battle regression закрепляет:
- обычные цены Наёмников 1/3/3/5/9;
- replacement prices 10/18/18/26/42;
- default quote 26 Gold без healthy-reserve premium;
- King-only quote 108 Gold;
- deselect одной healthy Rook увеличивает quote с 26 до 52 Gold;
- wounded hero не считается healthy reserve;
- payment/debt/persistence остаются совместимыми.

## Human acceptance — Pass 1

Пользователь проверил финальный Balance Pass 1 preview и подтвердил: **«да, отлично, всё хорошо» — 2026-08-31**.

Accepted exact head: `de819f0aebc0bebf6898bf8d4d26ce172a4b408f`.
Accepted Cloudflare exact-head build: `23be38ab-5524-47eb-97d5-5ff92c6d39d8` — **SUCCESS**.
Accepted preview: `https://235d7c21-rpchess.mobigametim.workers.dev`.

После acceptance были изменены только `docs/06_BATTLE.md`, `docs/09_SETTLEMENT.md`, `docs/23_BALANCE_GATE.md`; gameplay/runtime tree не менялся.

## Merge / production closure — Pass 1

- Draft PR #103 закрыт unmerged после фиксации acceptance;
- accepted/docs-synced release head: `dedb5540475914add43ac2cc2127f008b797d880`;
- release exact-head Cloudflare build `a2d7c755-ad89-44d7-bdfb-0b7f00900cd7` — **SUCCESS**;
- identical non-Draft PR #104 squash-merged в `main` как `ed2bd8fe4c116c7c38aebbf4955a105bd80c0fb4`;
- release head и production merge имеют одинаковый tree SHA `a881c9788fdc8e97210e2dea013e09f6d5d33286`;
- merged diff: **7 files / 0 assets**;
- persistence schema version changes: **0**;
- manual `game/assets/heroes/*/piece_badge.png` не затронуты;
- GitHub Actions не использовались.

## Balance Pass 2 — утверждённый contract 2026-08-31

После диагностики пользователь утвердил следующие решения.

### 1. Ранний Battle не запрещается
Даже если ранний Battle экономически или тактически невыгоден, это допустимый выбор. Игрок сам решает, когда он готов нажать Battle. Дополнительные запреты, forced routing или anti-avoidance правила не вводятся.

### 2. King-only Battle — смертельный исход после боя
Battle preparation по-прежнему разрешает снять всех non-King именных героев и выйти в полноценную Battle только с персонализированным King и Наёмниками.

Но если в `participants` этой Battle находится **ровно один именной участник и это run King**, то после завершения партии:
- King получает `status = dead`;
- run получает `ended = true`;
- `endReason = king_solo_battle`;
- `lastBattle.kingDied = true`;
- открывается существующий Battle run-end flow `КОРОЛЬ ПОГИБ`.

Правило не зависит от результата партии и не зависит от наличия/отсутствия Mercenary debt. Оно срабатывает именно после завершённой Battle.

Если вместе с King участвует хотя бы **один** другой именной герой, этот специальный исход не применяется.

### 3. Adaptive route choice не меняется
Игрок может сознательно выбирать более лёгкие карточки. Adaptive offset, три независимые route cards и Power/Threat contract не меняются.

### 4. Supplies / Settlement / Starvation не меняются
Остаются текущие значения:
- старт 10 Supplies;
- Travel = 1 Supply;
- Settlement Supply price = 12 Gold;
- stock = 4;
- текущий Starvation contract без изменений.

### 5. Минимальный Skirmish состав
Skirmish больше нельзя начинать одним King.

Минимум:
- обязательный run King;
- **+ минимум 1 другая доступная именная фигура**.

То есть минимальный состав Skirmish = **2 именные фигуры: King + 1**. Лимиты 16 фигур / 39 очков сохраняются.

### 6. Battle victory reward
Единственная изменяемая reward-ручка Pass 2:

`Battle victory = 36 + 6 × stars`

Диапазон ★1…★12:
- ★1 = **42 Gold**;
- ★12 = **108 Gold**.

Battle draw остаётся половиной соответствующей victory reward с `floor`, loss = 0.

Skirmish reward и Puzzle reward не меняются.

## Pass 2 regression contract

Обязательные проверки:
- Battle ★1 victory = 42 Gold;
- Battle ★5 victory = 66 Gold;
- Battle ★5 draw = 33 Gold;
- Battle ★12 victory = 108 Gold;
- Skirmish reward formula не изменилась;
- Skirmish `King only` отклоняется как `minimum_force`;
- Skirmish `King + 1 healthy named` валиден;
- обычная Battle с King + хотя бы 1 named не завершает run только из-за состава;
- King-only Battle после завершения делает King `dead`, ставит `ended=true`, `endReason=king_solo_battle` и `lastBattle.kingDied=true`;
- Mercenary pricing Pass 1 остаётся 1/3/3/5/9 и 10/18/18/26/42;
- persistence schema version не меняется;
- assets не меняются;
- GitHub Actions не используются.

## Замороженные ручки Pass 2

Без изменений:
- Starting Gold / Supplies;
- Travel Supply cost;
- healing / recruitment;
- Settlement Supply price / stock;
- Skirmish reward;
- Puzzle reward;
- Mercenary base/replacement prices и Supply fallback;
- Power / K-factor / adaptive offsets / Elo table;
- Event economy/content.

## Pass 2 gate receipt

Первый Cloudflare build на head `37137157475c56d5a7fa9b196036434c52693d6d` — `37ceeb64-4909-43c8-b059-20318f4fb54f` — **FAILED**. Причина была в source verification contract: `scripts/verify-source.cjs` требовал исторический literal `kingDied:false`, тогда как первая реализация solo-King consequence записывала поле напрямую как `kingDied:soloKing`.

Runtime исправлен без изменения gameplay-контракта: обычная Battle теперь явно создаёт `lastBattle.kingDied=false`, а solo-King outcome после этого переключает поле в `true`.

Исправленный gameplay exact head: `a02404adc9f7f5949b314c49a47547efd3973cfc`.

Cloudflare Workers build `00ce6b43-53f7-4fda-b775-6c4f3c7c6503` — **SUCCESS**. Version `aa910f09-f439-4470-9f44-1d418416dac7`.

Preview: `https://aa910f09-rpchess.mobigametim.workers.dev`.
Stable branch preview: `https://feature-balance-gate-pass2-rpchess.mobigametim.workers.dev`.

## Pass 2 lifecycle

Текущий lifecycle: **CONTRACT APPROVED → IMPLEMENTED → REGRESSION UPDATED → CLOUDFLARE GATE SUCCESS → HUMAN PLAYTEST PENDING**.

Ветка: `feature/balance-gate-pass2`.
Draft PR: `#105`.

До human acceptance Pass 2 не сливается в `main`.
