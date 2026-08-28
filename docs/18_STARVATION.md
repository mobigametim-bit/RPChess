# 18 — Starvation

**Статус:** IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED. Merge/post-merge closure pending before DONE.

Starvation — отдельный слой последствий перехода без припасов. Он не меняет шахматные правила, Skirmish/Battle generators или Settlement economy: механика срабатывает только между необратимым выбором Travel route и запуском уже выбранного encounter.

## Условие срабатывания

Новый committed Travel Choice по-прежнему запрашивает `1 Supply`.

- Если `supplyPaid = 1`, переход работает как раньше и Starvation не срабатывает.
- Если Supplies недостаточно и committed transition получает `supplyPaid = 0`, до запуска encounter погибает ровно одна живая персонализированная фигура.
- Supplies никогда не становятся отрицательными.
- Повторное открытие уже committed route не создаёт второй travel charge и не запускает вторую Starvation casualty.

## Предупреждение до выбора

При `0 Supplies` каждая Travel card заранее показывает:

`ПРИПАСОВ НЕТ · СЛУЧАЙНЫЙ БОЕЦ ПОГИБНЕТ`

Выбор остаётся одношаговым и необратимым: отдельного confirm dialog нет.

## Пул жертвы

В пул входят все живые персонализированные фигуры текущего roster:

- `healthy`;
- `wounded`;
- обязательный run King участвует на тех же условиях.

`dead` никогда не выбираются повторно. Generic Battle replacements не являются persistent roster characters и в Starvation не участвуют.

## Детерминированный выбор

Для игрока жертва случайна, но runtime выбирает её детерминированно из `run.id + activeTravelChoice`.

Это обязательный persistence contract:

- reload не перебрасывает жертву;
- повторный вызов resolution не убивает второго персонажа;
- victim id сохраняется внутри `activeTravelChoice` до показа consequence screen;
- текущая save schema `rpchess.reboot.v1.run` остаётся обратно совместимой и не требует version bump.

Committed route хранит:

- `starvationVictimId`;
- `starvationKingDied`;
- `starvationAcknowledged`.

## Обычная смерть

Если выбран не King:

1. фигура немедленно получает `status = dead` и сохраняется;
2. выбранный encounter ещё не запускается;
3. открывается отдельная frameless CSS-only сцена `ГОЛОД` с portrait, именем и ролью погибшего;
4. CTA `ПРОДОЛЖИТЬ ПУТЬ` один раз фиксирует acknowledgement;
5. после acknowledgement запускается тот же уже committed encounter.

Reload до acknowledgement снова открывает `ГОЛОД` с тем же погибшим.

## Смерть Короля

Если жертвой выбран run King:

- King получает `status = dead`;
- run немедленно получает `ended = true` и `endReason = starvation_king`;
- выбранный encounter не запускается;
- consequence screen показывает `КОРОЛЬ ПОГИБ ОТ ГОЛОДА`;
- CTA ведёт в главное меню.

## UI invariant

Starvation использует только frameless CSS surface:

- `var(--ui-panel-border)`;
- `var(--ui-panel-bg)`;
- `.ui-panel-safe`;
- approved blue CTA.

`ui_panel_frame.png` и `ui_panel_wide.png` запрещены. Mobile 390×844 должен работать вертикально без horizontal overflow.

## Acceptance contract

Автоматические gates подтвердили:

- casualty только при insufficient Supplies;
- `healthy + wounded + King` в пуле;
- ровно одну смерть;
- детерминированный victim;
- reload/idempotency без reroll и duplicate death;
- non-King acknowledgement перед encounter;
- King death завершает run до encounter;
- сохранение `supplyPaid = 0` и Supplies = 0;
- отсутствие регрессий Resources / Settlement / Travel Choice;
- mobile 390×844;
- полный real Chromium regression Foundation → Classic Chess → Stockfish → Roster → Skirmish → Battle → Travel Choice → Resources → Settlement → Starvation.

Пользователь выполнил живой playtest и 2026-08-28 подтвердил: **«все хорошо, ручной тест провел»**. Starvation считается HUMAN ACCEPTED. До статуса DONE остаются только acceptance-docs exact-head gates, merge PR #75 и post-merge production verification `main`.

## Accepted preview metadata

Feature branch: `feature/starvation`.  
Version: `2.9.0-starvation.preview.1`.  
Accepted gameplay head: `f8178ec8cf44600b7e49f46c50b9c94dadcd202a`.  
GitHub Actions push `33171829543`: **SUCCESS**, включая full real Chromium regression.  
GitHub Actions PR `33171832251`: **SUCCESS**, включая full real Chromium regression.  
Cloudflare build `ac8e3a37-701e-433b-b8d5-4c03fa81499e`: **SUCCESS**.  
Cloudflare Version `18279a28-8e49-4b12-8ea2-4c87cb2c1545`.  
Accepted preview: `https://18279a28-rpchess.mobigametim.workers.dev`.  
Human acceptance: **accepted 2026-08-28**.
