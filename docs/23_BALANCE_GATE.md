# 23 — Balance Gate

## Статус

**AUDIT COMPLETE → PASS 1 REVISED BY USER → IMPLEMENTED → GATE/DEPLOY PENDING → HUMAN BALANCE RUN PENDING.**

Balance Gate не добавляет новую механику. Цель — свести уже существующие Gold / Supplies / Settlement / Battle Mercenaries / Puzzle rewards / Power-Threat в один экономически связный контракт и затем проверить его длинным живым забегом.

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

### Battle Mercenaries
- Pawn 1 / Knight 3 / Bishop 3 / Rook 5 / Queen 9 Gold
- Supply fallback value: **1 Supply = 10 Gold**
- полный generic non-King комплект стоит **39 Gold**
- со стартовым roster (Rook + Bishop + Knight + 2 Pawns) добор Battle стоит **26 Gold**, если все стартовые named heroes выбраны и здоровы

### Power / Threat
- starting Power: **500**
- K-factor: **32**
- base threat: `floor((Power - 400) / 200) + 1`, clamp ★1…★12
- adaptive route offset: +0 / +1 / +2 / +3 с вероятностями **40% / 30% / 20% / 10%**
- при Power 500 обычный боевой/Puzzle route получает ★1…★4 с распределением 40/30/20/10

## История Pass 1

Первый вариант Pass 1 поднимал healing до 20/36/36/52/84 и recruitment до 72/126/126/192/288. После первого preview пользователь изменил направление: **лечение откатить к baseline, стоимость найма снизить на 30% от текущего Pass 1**.

## Balance Pass 1 — актуальная ревизия

Healing возвращён к baseline:
- Pawn **10**
- Knight **18**
- Bishop **18**
- Rook **26**
- Queen **42**

Recruitment уменьшен на 30% от предыдущих значений 72/126/126/192/288. После округления до ближайшего целого Gold:
- Pawn **50** (`72 × 0.7 = 50.4`)
- Knight **88** (`126 × 0.7 = 88.2`)
- Bishop **88** (`126 × 0.7 = 88.2`)
- Rook **134** (`192 × 0.7 = 134.4`)
- Queen **202** (`288 × 0.7 = 201.6`)

Regression закрепляет полный `HEAL_COSTS` / `RECRUIT_COSTS`, включая Queen 42 / 202, и фактическое списание 10 Gold за лечение Pawn.

## Замороженные ручки Pass 1

Без изменений:
- старт 80 Gold / 10 Supplies;
- Travel = 1 Supply;
- Supply shop = 12 Gold, stock 4;
- Skirmish/Battle rewards;
- Puzzle rewards;
- Battle Mercenary costs и fallback 10 Gold per Supply;
- Power 500, K=32, star/Elo table и adaptive offset;
- Event economy/content.

## Что проверяем после ревизии

Human balance run должен ответить на вопросы:
- лечение остаётся доступной операцией восстановления и не конкурирует слишком жёстко с развитием;
- найм требует накопления, но Pawn/Knight/Bishop не ощущаются чрезмерно далёкими целями;
- Queen за 202 Gold остаётся дорогой, но достижимой покупкой в длинном забеге;
- Gold приходится распределять между recruitment / Supplies / Battle mercenaries;
- Supplies требуют планирования, но не заставляют постоянно выбирать Settlement;
- Battle экономически рискованнее Skirmish, но reward компенсирует риск;
- рост Power не создаёт резкого скачка сложности;
- Puzzle не становится доминирующей или бесполезной Gold-стратегией;
- Events не ломают экономику чрезмерными выплатами/штрафами.

## После human run

Только по наблюдаемой проблеме открывается Pass 2. Возможные отдельные ручки: combat reward slope/base, Puzzle reward, Supply price/stock, Mercenary price, Power K/base/offset. Их нельзя менять пакетом без диагностической причины.

## Revision receipt

- branch: `feature/balance-gate`;
- original Pass 1 gameplay candidate: `3724bf7b6264bb9e8cd6380f1806e3f31576e9ef` — **SUPERSEDED**;
- revised runtime commit: `7be43499f2f537ffeaa0a4a264df395324ff79d7`;
- revised regression commit: `4fe5ae51017d9d7eb02b405cb2c89ab48d4dfaf4`;
- feature diff remains limited to Balance doc + Settlement runtime/test;
- assets changed: **0**;
- persistence schema changes: **0**;
- GitHub Actions: **не используются**.

## Safety

- gameplay architecture и persistence schema не меняются;
- assets не трогаются;
- manual `game/assets/heroes/*/piece_badge.png` не трогаются;
- GitHub Actions не используются;
- canonical gate: `npm run gate:local` + Cloudflare exact-head SUCCESS + human acceptance перед merge.
