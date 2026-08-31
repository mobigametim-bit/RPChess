# 23 — Balance Gate

## Статус

**AUDIT COMPLETE → PASS 1 REVISED BY USER → IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN BALANCE RUN PENDING.**

Balance Gate не добавляет новую шахматную механику. Цель — свести уже существующие Gold / Supplies / Settlement / Battle Mercenaries / Puzzle rewards / Power-Threat в один экономически связный контракт и затем проверить его длинным живым забегом.

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

## Balance Pass 1 — актуальная ревизия

### Settlement healing
Healing возвращён к baseline:
- Pawn **10**
- Knight **18**
- Bishop **18**
- Rook **26**
- Queen **42**

### Settlement recruitment
Recruitment уменьшен на 30% от предыдущих значений 72/126/126/192/288. После округления до ближайшего целого Gold:
- Pawn **50** (`72 × 0.7 = 50.4`)
- Knight **88** (`126 × 0.7 = 88.2`)
- Bishop **88** (`126 × 0.7 = 88.2`)
- Rook **134** (`192 × 0.7 = 134.4`)
- Queen **202** (`288 × 0.7 = 201.6`)

### Battle Mercenaries — healthy reserve pricing
Свобода выбора состава сохраняется: игрок по-прежнему может снять любого здорового именного героя кроме King.

Дешёвая цена Наёмника применяется, когда слот действительно нечем закрыть персональным бойцом:
- Pawn **1 Gold**
- Knight **3 Gold**
- Bishop **3 Gold**
- Rook **5 Gold**
- Queen **9 Gold**

Если здоровый именной герой соответствующего типа есть в roster, но не выбран, Наёмник, реально занимающий его освободившийся стандартный слот, получает replacement price. Она равна текущей стоимости лечения и поэтому гарантированно не ниже неё:
- Pawn **10 Gold**
- Knight **18 Gold**
- Bishop **18 Gold**
- Rook **26 Gold**
- Queen **42 Gold**

Правило считается **поштучно**:
- premium применяется только к числу здоровых unselected heroes данного типа;
- premium не может примениться к большему числу фигур, чем реально пустых standard slots;
- wounded/dead не создают premium: замена такой фигуры остаётся обычным дешёвым Наёмником;
- отсутствие героя данного типа также оставляет обычную цену;
- King системой Наёмников не заменяется.

Контрольные точки:
- стартовый roster/default selection: **10 Наёмников / 26 Gold**, без premium;
- `King only` со стартовым здоровым roster: **15 Наёмников / 108 Gold**;
- в King-only составе premium получают Rook + Bishop + Knight + 2 Pawn, остальные 10 фигур остаются обычными Наёмниками;
- если одна стартовая Pawn wounded, King-only quote снижается до **99 Gold**, потому что wounded Pawn больше не считается здоровым резервом.

UI Battle preparation явно сообщает правило: свободный слот — дешёвый Наёмник; замена оставленного в резерве здорового героя стоит как его лечение.

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

## Что проверяем в human balance run

Human balance run должен ответить на вопросы:
- лечение остаётся доступной операцией восстановления;
- Pawn/Knight/Bishop доступны для найма без чрезмерного гринда;
- Queen за 202 Gold остаётся дорогой, но достижимой целью;
- сознательное сохранение здоровых героев в резерве остаётся допустимой, но дорогой стратегией, а не экономическим exploit;
- игроку по-прежнему выгодно использовать roster, но дешёвые Наёмники спасают при реальной нехватке фигур;
- Gold приходится распределять между recruitment / healing / Supplies / Battle mercenaries;
- Supplies требуют планирования, но не душат забег;
- Battle/Skirmish/Puzzle rewards не создают очевидную доминирующую Gold-стратегию;
- рост Power не создаёт резкого скачка сложности;
- Events не ломают экономику чрезмерными выплатами/штрафами.

## После human run

Только по наблюдаемой проблеме открывается Pass 2. Возможные отдельные ручки: combat reward slope/base, Puzzle reward, Supply price/stock, Mercenary base price, Power K/base/offset. Их нельзя менять пакетом без диагностической причины.

## Revision receipt

- branch: `feature/balance-gate`;
- original Pass 1 gameplay candidate: `3724bf7b6264bb9e8cd6380f1806e3f31576e9ef` — **SUPERSEDED**;
- revised Settlement candidate: `883cf6cbfe886de5fee25028244c4c8bc5de527d` — **SUPERSEDED by healthy-reserve rule**;
- Settlement runtime commit: `7be43499f2f537ffeaa0a4a264df395324ff79d7`;
- Settlement regression commit: `4fe5ae51017d9d7eb02b405cb2c89ab48d4dfaf4`;
- healthy-reserve runtime commit: `689bdeec1754425e5f61b75535e06ed6fb119d4d`;
- healthy-reserve regression / exact gameplay candidate: `46a33ffc10110bd89134bfa8fe86f026945bc4ed`;
- gameplay Cloudflare build `b5bf6322-3e6b-4410-8e21-32a0b0d0a3f2` — **SUCCESS**;
- gameplay preview: `https://b8d65a6f-rpchess.mobigametim.workers.dev`;
- synced docs exact head: `cfa442f17ecb6568efed59903d30846a9f085fe4`;
- synced docs Cloudflare build `98a3af5e-bb36-4c2b-acbb-8232f5b1ab68` — **SUCCESS**;
- synced docs preview: `https://0d19d571-rpchess.mobigametim.workers.dev`;
- assets changed: **0**;
- persistence schema version changes: **0**;
- GitHub Actions: **не используются**.

## Safety

- шахматные правила и Battle selection UX не меняются;
- persistence schema version не меняется;
- assets не трогаются;
- manual `game/assets/heroes/*/piece_badge.png` не трогаются;
- GitHub Actions не используются;
- canonical gate: Cloudflare exact-head через `npm run gate:local` + human acceptance перед merge.
