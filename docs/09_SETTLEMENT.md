# 09 — Settlement

**Статус:** IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED. Feature merge и post-merge production closure ещё обязательны до DONE.

Пользователь завершил живой Settlement playtest 2026-08-27 и подтвердил: **«проверил, все хорошо, все работает»**.

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

Цены:
- Pawn — **10 Gold**;
- Knight — **18 Gold**;
- Bishop — **18 Gold**;
- Rook — **26 Gold**;
- Queen — **42 Gold**.

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

Цены:
- Pawn — **24 Gold**;
- Knight — **42 Gold**;
- Bishop — **42 Gold**;
- Rook — **64 Gold**;
- Queen — **96 Gold**.

Текущая реализация использует deterministic pool из **33 non-King named heroes**.

## Снабжение

- **12 Gold = 1 Supply**.
- Локальный запас Settlement: **4 Supplies**.
- Покупка по одному Supply за клик.
- Остаток stock сохраняется и не восстанавливается после reload.
- Глобального cap Supplies в v1 нет.

## Persistence

Run save остаётся `rpchess.reboot.v1.run` и backward compatible.

Settlement сохраняет `currentSettlement` с route/seed, тремя recruit offers, supply stock и состоянием операций. Повторный вход после Roster/reload возобновляет то же посещение; route cost не списывается повторно.

## Acceptance / technical receipts

Accepted gameplay head: `92e9387d5afe806af47f05a23105622309742be4`.

Version: `2.8.0-settlement.preview.1`.

GitHub Actions #946 / `33114651996`: **SUCCESS**. Проверены source contract, deterministic Foundation/Chess/AI/Roster/Skirmish/Battle/Travel/Resources/Settlement tests, build/distribution boundary и полный real Chromium regression Foundation → Classic Chess → Stockfish → Roster → Skirmish → Battle → Travel Choice → Resources → Settlement.

Cloudflare Build `1aaa73d9-064b-4e01-ae51-62abfb0ec9a9`: **SUCCESS**. Version `a79ca435-1006-4f3e-bd0a-c2cac5dd8f4b`.

Accepted preview: `https://a79ca435-rpchess.mobigametim.workers.dev`  
Alias: `https://feature-settlement-rpchess.mobigametim.workers.dev`

Human acceptance: **accepted 2026-08-27**.

Settlement станет **DONE** только после acceptance-docs exact-head CI/Cloudflare, feature PR squash-merge и успешных post-merge `main` gates.
