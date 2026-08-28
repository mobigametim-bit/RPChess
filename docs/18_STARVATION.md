# 18 — Starvation

**Статус:** IMPLEMENTED → AUTOTEST/DEPLOY gates in progress → HUMAN ACCEPTED pending.

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

Автоматические gates должны подтвердить:

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

После зелёных exact-head GitHub Actions + Cloudflare создаётся/обновляется deploy preview для живого теста. Starvation не merge-ится и не становится DONE до явного HUMAN ACCEPTED пользователя.

## Preview metadata

Feature branch: `feature/starvation`.  
Version: `2.9.0-starvation.preview.1`.  
Human acceptance: **pending**.
