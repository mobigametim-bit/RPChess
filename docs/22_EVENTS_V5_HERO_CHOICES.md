# 22 — Events v5 Hero Choices

## Статус

**SOURCE APPROVED → IMPLEMENTED → AUTOTEST PENDING → DEPLOY PENDING → HUMAN ACCEPTANCE PENDING.**

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
