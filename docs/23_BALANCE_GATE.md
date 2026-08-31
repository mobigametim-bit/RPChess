# 23 — Balance Gate

## Статус

**AUDIT COMPLETE → TUNING CONTRACT PENDING USER APPROVAL.**

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

### Settlement — текущие production цены
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
- при Power 500 обычный боевой/Puzzle route поэтому получает ★1…★4 с распределением 40/30/20/10

## Найденный разрыв

Ранее был согласован повышенный Settlement tuning, но при Endless Run reconciliation он намеренно не был перенесён поверх production economy и поэтому сейчас не действует.

Согласованный повышенный набор:

Healing:
- Pawn **20**
- Knight **36**
- Bishop **36**
- Rook **52**
- Queen **84**

Recruitment:
- Pawn **72**
- Knight **126**
- Bishop **126**
- Rook **192**
- Queen **288**

Этот набор сохраняет лечение примерно на уровне 27–29% стоимости нового героя соответствующего класса и делает найм долгосрочным решением, а не покупкой после одной удачной встречи.

## Предлагаемый Balance Pass 1

**Изменить только Settlement healing/recruitment на ранее согласованные повышенные значения.**

На первом pass оставить без изменений:
- старт 80 Gold / 10 Supplies;
- Travel = 1 Supply;
- Supply shop = 12 Gold, stock 4;
- Skirmish/Battle rewards;
- Puzzle rewards;
- Battle Mercenary costs и fallback 10 Gold per Supply;
- Power 500, K=32, star/Elo table и adaptive offset;
- Event economy/content.

Причина: текущие остальные формулы уже образуют полезные контрольные точки. Например, стартовый Battle требует 26 Gold на Наёмников, а ★1 Battle даёт 26 Gold за победу — ранняя Битва не является бесплатной Gold-фермой. Одновременная правка rewards, mercenary costs, Supplies и Settlement уничтожит возможность понять, какая именно ручка улучшила или ухудшила забег.

## Что проверяем после Pass 1

Human balance run должен ответить на вопросы:
- Gold приходится выбирать между healing / recruitment / Supplies / Battle mercenaries, а не покупать всё сразу;
- Pawn recruit достижим сравнительно рано, Queen recruit остаётся заметной долгосрочной целью;
- лечение ощутимо дешевле замены погибшего героя, но не бесплатное;
- Supplies требуют планирования, однако не заставляют постоянно выбирать Settlement;
- Battle экономически рискованнее Skirmish, но более высокая reward-кривая компенсирует риск на больших stars;
- рост Power не создаёт резкого скачка сложности;
- Puzzle не становится очевидно лучшим или худшим способом добычи Gold;
- Events не ломают экономику единичными чрезмерными выплатами/штрафами.

## После human run

Только по наблюдаемой проблеме открывается Pass 2. Возможные отдельные ручки: combat reward slope/base, Puzzle reward, Supply price/stock, Mercenary price, Power K/base/offset. Их нельзя менять пакетом без диагностической причины.

## Safety

- gameplay architecture и persistence schema не меняются;
- assets не трогаются;
- manual `game/assets/heroes/*/piece_badge.png` не трогаются;
- GitHub Actions не используются;
- canonical gate: `npm run gate:local` + Cloudflare exact-head SUCCESS + human acceptance перед merge.
