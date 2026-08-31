# 23 — Balance Gate

## Статус

**PASS 1 — IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → MERGED → DOCS SYNCED → DONE. BALANCE GATE CONTINUES.**

Balance Gate не добавляет новую шахматную механику. Цель — свести уже существующие Gold / Supplies / Settlement / Battle Mercenaries / Puzzle rewards / Power-Threat в один экономически связный контракт и затем проверять его контролируемыми balance-pass, меняя только диагностически обоснованные ручки.

## Текущий production baseline

### Старт
- Gold: **80**
- Supplies: **10**
- новый committed Travel: **1 Supply**

### Награды
- Skirmish victory: `12 + 4 × stars` → **16…60 Gold** на ★1…★12
- Battle victory: `20 + 6 × stars` → **26…92 Gold** на ★1…★12
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
- Queen **42 Gold**

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

## Regression

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

## После Pass 1

Balance Gate как общий этап остаётся открыт. Любой Pass 2 начинается только при конкретной наблюдаемой проблеме. Возможные отдельные ручки: combat reward slope/base, Puzzle reward, Supply price/stock, Mercenary base price, Power K/base/offset. Их нельзя менять пакетом без диагностической причины.
