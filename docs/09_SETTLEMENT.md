# 09 — Settlement

**Статус:** IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DONE.  
**Текущие economy values дополнительно регулируются Balance Gate 2026-08-31.**

Пользователь завершил живой Settlement playtest 2026-08-27 и подтвердил: **«проверил, все хорошо, все работает»**. Feature squash-merged в `main`; historical verification receipts ниже сохранены как история принятой Settlement v1.

Settlement — безопасная остановка внутри Travel loop. V1 содержит ровно три услуги: лечение, найм и снабжение. Отдельной RPG-экипировки, талантов, crafting, abilities или специальной боевой системы нет.

## Вход через Travel Choice

Playable pool: `Skirmish / Battle / Settlement`.

- Каждая тройка гарантирует минимум одну Стычку и одну Битву.
- Третья карточка детерминированно выбирается из playable типов, поэтому Settlement появляется примерно в 1/3 развилок и не занимает несколько карточек одновременно.
- Вход стоит обычный `−1 Supply` и фиксируется тем же мгновенным необратимым кликом route card.
- Settlement не показывает combat threat/stars; вместо них используется `БЕЗОПАСНОЕ МЕСТО · ЛЕЧЕНИЕ · НАЙМ · СНАБЖЕНИЕ`.
- Flavor берётся из существующего settlement pool Travel Choice.

## Главная сцена

Frameless CSS-only scene с постоянным Gold/Supplies HUD.

Разделы:
- `ЗНАХАРКА`;
- `ТАВЕРНА`;
- `СНАБЖЕНИЕ`.

Вторичная кнопка `ОТРЯД` позволяет посмотреть roster и вернуться в то же Settlement. `ПРОДОЛЖИТЬ ПУТЬ` закрывает посещение и открывает следующую Travel Choice без дополнительного расхода Supplies.

Покупки сохраняются сразу. Reload / Roster не меняют recruit offers, supply stock и уже совершённые операции.

## Знахарка

Лечение только `wounded → healthy`. Dead не лечатся. King не лечится здесь, поскольку смерть run King уже завершает забег.

**Принятые Balance Gate цены лечения:**
- Pawn — **10 Gold**;
- Knight — **18 Gold**;
- Bishop — **18 Gold**;
- Rook — **26 Gold**;
- Queen — **42 Gold**.

Balance Gate сначала тестировал удвоенные healing prices, но пользователь отменил это направление и вернул лечение к исходным Settlement values.

Если раненых нет: `Все бойцы готовы к пути.` Покупка выполняется сразу по `ЛЕЧИТЬ`, без второго confirm.

## Таверна

Каждое Settlement получает **3 детерминированных кандидата** из существующей repository library named heroes.

- Offers зависят от settlement seed и стабильны после reload / Roster.
- King-типы не предлагаются.
- Текущий roster и погибшие в этом run персонажи исключаются.
- Ненанятый персонаж может встретиться в будущем Settlement.
- Можно нанять несколько кандидатов при наличии Gold.
- Нанятый герой добавляется `healthy` и использует существующие `portrait.png` + `piece_badge.png`.
- Legacy abilities не возвращаются: используются identity, имя, origin/faction, classic `pieceType` и visual assets.

**Принятые Balance Gate цены найма:**
- Pawn — **50 Gold**;
- Knight — **88 Gold**;
- Bishop — **88 Gold**;
- Rook — **134 Gold**;
- Queen — **202 Gold**.

Эти значения получены уменьшением на 30% от предыдущего Balance Pass 1 набора 72/126/126/192/288 с округлением до ближайшего целого Gold. Historical Settlement v1 prices до Balance Gate были 24/42/42/64/96.

Текущая реализация использует deterministic pool из **33 non-King named heroes**.

## Связь с Battle Mercenaries

В Balance Gate стоимость лечения также стала нижней границей для сознательной замены **healthy** именного героя Наёмником в Battle. Если healthy герой оставлен в резерве, replacement mercenary соответствующего типа стоит 10/18/18/26/42 Gold. Это не меняет стоимость самого лечения и не касается wounded/dead героев.

## Снабжение

- **12 Gold = 1 Supply**.
- Локальный запас Settlement: **4 Supplies**.
- Покупка по одному Supply за клик.
- Остаток stock сохраняется и не восстанавливается после reload.
- Глобального cap Supplies в v1 нет.

Supply price/stock в текущем Balance Pass 1 не менялись.

## Persistence

Run save остаётся `rpchess.reboot.v1.run` и backward compatible.

Settlement сохраняет `currentSettlement` с route/seed, тремя recruit offers, supply stock и состоянием операций. Повторный вход после Roster/reload возобновляет то же посещение; route cost не списывается повторно.

Balance Gate меняет только числовые economy constants; version persistence schema не меняется.

## Balance Gate Pass 1 acceptance receipt

- healing: **10 / 18 / 18 / 26 / 42**;
- recruitment: **50 / 88 / 88 / 134 / 202**;
- Settlement runtime revision commit `7be43499f2f537ffeaa0a4a264df395324ff79d7`;
- Settlement regression commit `4fe5ae51017d9d7eb02b405cb2c89ab48d4dfaf4`;
- healthy-reserve Battle pricing gameplay candidate `46a33ffc10110bd89134bfa8fe86f026945bc4ed`;
- accepted exact head `de819f0aebc0bebf6898bf8d4d26ce172a4b408f`;
- accepted Cloudflare exact-head build `23be38ab-5524-47eb-97d5-5ff92c6d39d8` — **SUCCESS**;
- Human acceptance: **«да, отлично, всё хорошо» — 2026-08-31**;
- GitHub Actions не используются для текущего workflow.

## Acceptance / technical receipts — historical Settlement v1

Accepted gameplay head: `92e9387d5afe806af47f05a23105622309742be4`.

Version: `2.8.0-settlement.preview.1`.

Gameplay GitHub Actions #946 / `33114651996`: **SUCCESS**. Проверены source contract, deterministic Foundation/Chess/AI/Roster/Skirmish/Battle/Travel/Resources/Settlement tests, build/distribution boundary и полный real Chromium regression Foundation → Classic Chess → Stockfish → Roster → Skirmish → Battle → Travel Choice → Resources → Settlement.

Accepted gameplay Cloudflare Build `1aaa73d9-064b-4e01-ae51-62abfb0ec9a9`: **SUCCESS**. Version `a79ca435-1006-4f3e-bd0a-c2cac5dd8f4b`.

Accepted preview: `https://a79ca435-rpchess.mobigametim.workers.dev`  
Alias: `https://feature-settlement-rpchess.mobigametim.workers.dev`

Final feature head: `60c2bcbe616f6d1dc189e70cab8a0211d07274c1`.

Exact-head GitHub Actions #953 / `33118757504`: **SUCCESS**.  
PR-triggered GitHub Actions #954 / `33125160839`: **SUCCESS**, включая полный real Chromium regression.  
Exact-head Cloudflare build `9a09d556-0645-424e-83f4-7b2a1b460989`: **SUCCESS**; Version `d6b52b6a-7b66-4b81-950c-f7122dad0551`.

PR #73 `Settlement: healer, tavern recruitment and supply shop` squash-merged 2026-08-27.

Settlement merge / production `main` SHA: `854a0bd4535c6b3006fa11a207a011f3e3e2a0f2`.

Post-merge GitHub Actions #955 / `33125831513`: **SUCCESS**, включая полный real Chromium regression.  
Post-merge Cloudflare production build `6c973861-a04d-415b-b1fa-df1c110ee6d2`: **SUCCESS**; production Version `86a0ce13-e9eb-4366-b853-dc456ec7ba97`.

Human acceptance: **accepted 2026-08-27**.

Settlement v1 lifecycle окончательно закрыт: **IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → DONE**. Текущие economy values поверх него приняты в **Balance Gate Pass 1**.