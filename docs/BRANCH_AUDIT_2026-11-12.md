# RPChess — инвентаризация веток и CI от 12.11.2026

Источник: [GitHub Actions Branch Inventory #43200114511](https://github.com/mobigametim-bit/RPChess/actions/runs/43200114511), `scripts/audit-github-branches.cjs`. Это **read-only audit**, а не команда на удаление.

## Сводка

- **223** refs включая вновь созданную ветку переорганизации CI;
- **69** branch tips не содержат уникальных коммитов относительно `main`;
- **154** ветки имеют уникальные коммиты — сохраняем до индивидуального разбора;
- **178** refs без новых коммитов 30+ дней; **153** refs 60+ дней;
- **22** консервативных cleanup-кандидата: 60+ дней, `ahead_by=0`, нет открытого PR, protected refs и буквальных ссылок в workflow; **0 ошибок API**.
- 3 исходных открытых Draft PR: #180 Netlify, #158 preloading, #137 VK; их ветки оставляем.
- Историческое количество workflow на `main` до PR — **38**; во время audit checkout рабочей CI-ветки — **41** (позднее добавлены дополнительные рабочие workflow).
- Кандидаты получены через GitHub REST сравнение `main...branch` и метаданные последнего коммита. «Старше недели» не повод для удаления.

## 22 предварительных кандидата на удаление

| Ветка | Дней без новых коммитов на момент аудита | Уникальных коммитов относительно main |
|---|---:|---:|
| `assets/register-01-production` | 98 | 0 |
| `assets/register-01-runtime-application` | 98 | 0 |
| `audit/full-project-review-2026-09-08-runtime` | 64 | 0 |
| `audit/full-project-review-2026-09-08` | 63 | 0 |
| `docs/current-state-sync` | 65 | 0 |
| `feature/iron-marches-production-closure` | 78 | 0 |
| `feature/king-pin-ice-safety-check` | 69 | 0 |
| `feature/live-device-glyph-polish` | 65 | 0 |
| `feature/post-live-test-ui-followup` | 66 | 0 |
| `feature/post-pages-ui-polish` | 66 | 0 |
| `feature/register-01-05-asset-audit` | 96 | 0 |
| `feature/supplies-resource-icon` | 65 | 0 |
| `feature/travel-choice-tmp-check` | 76 | 0 |
| `fix/battle-solo-king-run-end` | 61 | 0 |
| `perf/background-asset-runtime-budget-probe` | 70 | 0 |
| `platform/vk-premoderation-2026-09-13` | 61 | 0 |
| `rendering/browser-modular-board` | 99 | 0 |
| `runtime/vertical-slice-adapter` | 99 | 0 |
| `temp-noop` | 97 | 0 |
| `tmp-invalid` | 77 | 0 |
| `tmp-stop` | 77 | 0 |
| `ui/reserve-presentation` | 98 | 0 |

**Не удалено ни одной ветки.** До применения ещё раз проверить live HEAD каждой ветки на неизменность SHA, отсутствие новых PR и других зависимостей. Старые CI артефакты и Cloudflare previews не следует считать полностью проверенными только по имени workflow; при сомнении сохранять ветку.

## Содержание workflow

На `main` были **38** workflow: один Pages CI/release, один Full Project Review и множество самостоятельных preview/diagnostic/asset/worker workflows. Большая часть preview workflow привязана к конкретным старым feature/fix-веткам по `push.branches`, и их **нельзя удалять вслепую**: проверяем реальное использование, ценность воспроизводимого QA и ссылки на среды перед архивированием.

Новая схема в [DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md) вводит PR Focused Checks, Release Gate и отдельный production workflow. Удаление тестов только ради уменьшения числа файлов запрещено.

## Дальнейшие действия

1. Довести CI PR до успешного запуска, дождаться owner acceptance, затем full release gate.
2. На GitHub включить защиту `main` с двумя required checks и запретом прямого обхода.
3. Для 22 кандидатов получить отдельное финальное подтверждение на физическое удаление, выполнить повторную проверку tips и использовать безопасный API/Actions workflow с логом результата.
4. Ветки с уникальными коммитами и незавершёнными PR не трогать.
5. Списки устаревших workflow верифицировать по фактическим trigger refs и использованию перед архивированием.
