# RPChess — правила разработки, тестирования и содержания GitHub
Дата утверждения принципов: **2026-11-12**. Канонический источник правил: GitHub. Зафиксировано по прямому подтверждению владельца.

## 1. Жизненный цикл задачи

1. Создаём отдельную feature/fix-ветку от актуального `main` и Draft PR.
2. Во время разработки используем **адресный CI**: исходники, базовые технические контракты, сборка для игровых изменений и Node/Chromium-тесты только изменённых и сопряжённых систем. Непонятные изменения получают консервативный smoke/fallback; новая функциональность обязана иметь покрытие своего основного контракта. Не создаём дополнительные тесты ради количества.
3. Выкладываем **изолированный playable QA preview**, если нужна ручная проверка. Никаких PR-деплоев в production.
4. Владелец **лично принимает** результат и прямо говорит «сливай» / «принимаю, сливай». До этого PR остаётся незавершённым, в `main` ничего не попадает.
5. Только **после приёмки** уполномоченный участник ставит на PR label `release-approved`. По нему workflow `.github/workflows/release-gate.yml` выполняет **`npm run gate:full`**: source/static, Node-регрессии, контент, puzzle validation, build/assets, **все 36 текущих real-Chromium browser suites**. Красный или не запущенный release gate **не разрешает** merge.
6. Merge допустим лишь при `PR Focused Checks = success` и `Release Gate = success` для **точного текущего PR head + актуальной base**. Любой дополнительный commit после приёмки требует нового прогона; изменение `main` требует обновить PR и повторить проверку. Нельзя обходить это прямым push или настройкой `admin bypass`.
7. Сливаем проверенный PR в `main`. Production deploy запускается **отдельно**, по явной команде владельца и через разрешённый release-коммит / ручной workflow `.github/workflows/pages.yml`. Деплой из PR запрещён. После публикации проверяем GitHub Actions и production URL.
8. В отчёте фиксируем PR, SHA, тесты, QA URL, результат deploy и **следующие шаги**.

**Важно:** автоматика отвечает за технический допуск, но **не заменяет ручную приёмку**. Label сам по себе не свидетельствует о разрешении владельца: его можно ставить только после прямого подтверждения.

## 2. Реализация CI

| Этап | Workflow | Триггер | Что запускается |
|---|---|---|---|
| Итерации PR | `.github/workflows/pr-focused-checks.yml` | `pull_request` → `main` | Минимальный source/security/build gate и выбранные по `git diff` тесты сопряжённых систем; docs-only изменений тяжёлый прогон не нужен |
| Финальная приёмка | `.github/workflows/release-gate.yml` | PR `labeled`, `synchronize`, `reopened` и др. | Без `release-approved` — ожидание приёмки/неуспешный check; с label — `npm run gate:full` на PR integration tree |
| Ручной аудит | `.github/workflows/full-project-review.yml` | `workflow_dispatch` | Полный `gate:full`, не сокращённые 17 suites |
| Выпуск | `.github/workflows/pages.yml` | release commit в `main` / `workflow_dispatch` | Production build, завершающая проверка GitHub Pages /RPChess/, публикация при success |
| Бизнес-специфичный QA | feature/worker workflows | Изменения соответствующей ветки и явный запуск | Проверка отдельной интеграции/Worker/ассетов, строго вне production до релиза |

Правила выбора тестов реализованы в `scripts/select-pr-tests.cjs`. Неизвестная затронутая игровая подсистема **не должна молча остаться без browser smoke**. Для инфраструктурных изменений `package.json`, `scripts/`, `.github/workflows/` и тестового раннера выделен повышенный риск: CI обязано выполнить хотя бы foundation smoke; для глубокой миграции инфраструктуры назначаем полный audit по решению владельца.

Ветвление запуска не удаляет постоянные regression contracts. Удаляем только доказанно устаревшие, дублирующие или неприменимые тесты после анализа.

## 3. Защита main (обязательная конфигурация GitHub)

В Settings → Branches → Branch protection rules / Rulesets для `main`:
- Require a pull request before merging; prevent direct push and force push; restrict bypass.
- Require status checks: `PR Focused Checks` и `Release Gate`; require branch to be up to date before merging.
- Do not set `release-approved` до прямой команды владельца.
- Enable **Automatically delete head branches** for merged PRs (Settings → General → Pull Requests), **кроме** архивных/долгоживущих веток, которыми не следует управлять через PR auto-delete.
- Проверить правильные имена check/job в интерфейсе после первого CI запуска: имена должны точно совпадать.

**Оговорка:** изменения branch protection/rulesets требуют административного API/UI, не входят в сам commit workflow. Пока защита не включена, запрет преждевременного слияния является процессным правилом, а не серверной блокировкой.

## 4. Политика веток и удаления

- **Не удалять:** `main`, `deploy`, `Legasy`, `archive/*`, `backup/*`, `rollback/*`, `release/*`, `night/*`, ветки открытых PR, активные ветки, важные references deployment/production.
- После успешного merge обычная source-ветка PR удаляется **автоматически только при доказанной полноте слияния** через `.github/workflows/merged-branch-cleanup.yml`: SHA ветки должен совпадать с принятым PR, `ahead_by=0`, нет открытых PR и зависимостей workflow. При squash merge со своей уникальной commit history ветка будет сохранена до отдельной проверки.
- После **30 дней без коммитов** составляем кандидатов для аудита, после **60 дней** можно предложить очистку.
- Удалять автоматически в массовом режиме допустимо только ветки, у которых `ahead_by == 0` относительно `main` (нет уникальных коммитов), нет открытого PR, нет зависимости workflow/релиза, ветка не protected и есть точная проверка tip SHA прямо перед удалением.
- **Возраст 7 дней не является критерием удаления.** Если commit-история diverged (включая squash merge) и видны уникальные commit SHA, сохраняем ветку до отдельной проверки/архивации.
- Перед массовым удалением обязателен dry-run, проверка списка человеком и отдельное разрешение на фактическое удаление.
- Git refs — не копии репозитория. Удаление множества веток само по себе не гарантирует уменьшения storage; отдельно проверять Actions artifacts, caches и тяжёлую историю ассетов.
- Не удалять «лишние» тесты или workflow только ради количества; сначала аудит использования и связей. Специализированные preview workflow можно архивировать после подтверждённого закрытия соответствующего направления.

## 5. Исходная инвентаризация (12.11.2026, до чистки)

Полный перечень 22 кандидатов и проверенные цифры зафиксированы в [BRANCH_AUDIT_2026-11-12.md](BRANCH_AUDIT_2026-11-12.md), результат машинной проверки: [Actions #43200114511](https://github.com/mobigametim-bit/RPChess/actions/runs/43200114511).

- **222 ветки** по API `branches?per_page=100` (страницы: 100 + 100 + 22).
- **38 GitHub Actions workflow** в `.github/workflows/`.
- **3 открытых Draft PR**, требующих сохранения source-веток:
  - [#180](https://github.com/mobigametim-bit/RPChess/pull/180) `feature/ru-netlify-gateway-20261106`;
  - [#158](https://github.com/mobigametim-bit/RPChess/pull/158) `feature/scene-preload-transitions-20261016`;
  - [#136](https://github.com/mobigametim-bit/RPChess/pull/136) `platform/vk-games`.
- У репозитория по GitHub metadata размер `894980 KiB` (~874 MiB), что **не равно** объёму «222 копий проекта».
- Исходный `pages.yml` запускал все локальные тесты + **23 из 36** Chromium suites в каждом PR/push. Исходный `full-project-review.yml` запускал лишь **17 из 36**; обе конфигурации нуждались в нормализации.
- Состояние слияния, устаревания и уникальности всех 222 веток **не установлено** одной только выдачей списка refs. Перед удалением нужен полный compare/commit-date аудит; имена и даты в названиях не являются достаточным доказательством.

Реализацию нового процесса в отдельном PR нельзя считать принятой/активной до merge и зелёных проверок. Эта запись фиксирует утверждённые правила и исходный снимок репозитория.
