# 22 — Events v5 Hero Choices

## Статус

**SOURCE APPROVED → IMPLEMENTED → AUTOTESTED → DEPLOYED → HUMAN ACCEPTED → MERGED → DOCS SYNCED → DONE.**

Источник — утверждённый пользователем `events_v5.md`. SHA-256 исходного Markdown: `82eef9b76ac7af36d53cf96c6567449cf5c9fec9d106fd514ca9e5e83c86a191`.

## Контентный контракт

- события: **500 / 500**;
- персональные варианты: **537**;
- HERO-01–HERO-36: **36 / 36**;
- в каждом событии: **1–2** персональных варианта;
- минимальное покрытие героя: **8** вариантов;
- новых типов последствий: **0**;
- дословно повторяющихся `heroLine`: **0**.

Хранитель Клятвы остаётся текущим протагонистом / run King и не входит в collectible HERO-01–36 choices. Его существующие `[KING REACTION]` / `kingReaction` сохраняются отдельным слоем.

## Runtime

Канонический overlay: `game/js/events/event-hero-choices-v5.mjs` + три generated data-модуля.

Каждый персональный вариант содержит:

- `requiredHeroId` — конкретный именованный герой;
- `requiredHeroName`;
- `heroLine` — утверждённая реплика из Events v5;
- `sourceChoiceId` — существующий вариант того же события, чей механический пакет переиспользуется;
- прежние `chance / cost / successEffects / failureEffects / alwaysEffects / warnings`.

Если `sourceChoiceId` был абстрактным role-gated вариантом, он заменяется персональным вариантом/вариантами. Если `sourceChoiceId` был обычным вариантом без role gate, обычный вариант остаётся рядом, а персональный добавляется дополнительно.

## Доступность и UI

Если требуемый герой здоров и находится в отряде, вариант активен при выполнении обычных требований по Gold/Supplies.

Если героя нет, он ранен или погиб, вариант **не скрывается**. Он остаётся player-facing карточкой с именем и `heroLine`, но disabled:

- `🔒 <Герой> — НЕТ В ОТРЯДЕ`;
- `🔒 <Герой> — РАНЕН`;
- `🔒 <Герой> — ПОГИБ`.

Locked-карточки намеренно остаются хорошо читаемыми: их задача — показывать игроку пропущенную возможность и усиливать мотивацию искать/нанимать конкретных героев.

Для E001–E100 персональный вариант продолжает использовать принятую Events v3 action-copy своего `sourceChoiceId`; старый абстрактный `heroReaction` не дублируется поверх нового `heroLine`.

## Последствия

Events v5 **не добавляет новых механик событий**. Персональный вариант переиспользует механику `sourceChoiceId` того же события: Gold, Supplies, Recruit, wound/death, King-risk-derived consequence, Skirmish/Battle или no effect.

Если исходный role/King-specific пакет ранил или убивал героя роли, после персонализации target становится именно `requiredHeroId`. Это позволяет, например, риску Ваэля ранить Ваэля, а риску Эргена — затронуть Эргена, не подменяя его текущим Хранителем Клятвы.

Random non-King последствия остаются random non-King: Events v5 не меняет механику там, где источник не был role/King-specific.

## Совместимость

- базовый каталог остаётся **500 событий / 2114 authored base choices**;
- Events v3/v4 narrative не переписывается;
- Player Identity продолжает персонализировать narrative player-name;
- Hero Notes не меняются;
- combat race continuity, Power/Threat и event persistence не меняются;
- assets не добавляются и не заменяются;
- ручные hero `piece_badge.png` не затрагиваются;
- GitHub Actions не используются.

## Gate

`tests/events-v5.cjs` проверяет полный каталог:

- 500 event keys / 537 personal variants / 36 heroes;
- 1–2 варианта на событие и минимум 8 на героя;
- уникальность 537 `heroLine`;
- существование каждого `sourceChoiceId`;
- сохранение chance/cost/effect-пакетов;
- replacement role gate vs additive ordinary choice;
- visible locked semantics для absent/wounded/dead;
- точечный wound/death target конкретного героя;
- отсутствие ложного run-end при гибели named King-role героя, который не является текущим run King;
- наличие v5 UI/CSS-контракта.

Canonical deploy gate: `npm run gate:local` + Cloudflare exact-head **SUCCESS**, затем обязательный human acceptance перед merge.

## Acceptance / merge receipt

- Human acceptance: **«всё хорошо» — 2026-08-31**;
- exact accepted head: `4bdd002bf618f73077c74329cc2f16edd48667ac`;
- Cloudflare exact-head build: `90b126d9-1b28-4e60-8919-9b5d565a3f26` — **SUCCESS**;
- accepted commit preview: `https://01ad647c-rpchess.mobigametim.workers.dev`;
- stable branch preview: `https://feature-events-v5-hero-choices-rpchess.mobigametim.workers.dev`;
- Draft PR #100 закрыт unmerged только для established Draft→Ready workaround;
- identical non-Draft PR #101 squash-merged в `main` как `350e04783e4c4370dc490ff0745207b7f1b2ba11`;
- accepted head и production merge имеют одинаковый tree SHA `abe48127ce4a709a22ecfbc86142aefdff493188`;
- feature diff: **12 files / 0 asset files**;
- ручные hero assets сохранены;
- GitHub Actions не использовались.
