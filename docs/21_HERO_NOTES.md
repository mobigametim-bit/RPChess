# 21 — Hero Notes

## Статус

**SOURCE APPROVED → IMPLEMENTED → AUTOTEST PENDING → DEPLOY PENDING → HUMAN ACCEPTANCE PENDING.**

Фича закрывает player-facing короткие подписи именных героев перед Balance Gate. Источник текста — утверждённый `heroes_note.md`: 36 героев `HERO-01`–`HERO-36` из Register 02 и отдельно текущий Король стартового отряда — Хранитель Клятвы.

## Принцип

Подпись не пересказывает шахматный класс, стоимость или механику фигуры. Она должна за 1–2 предложения дать запоминаемую черту прошлого, характера или поведения героя, которую игрок затем может узнавать в событиях и репликах.

Текст подписей переносится в runtime без литературной переработки.

## Runtime contract

- Канонический словарь: `game/js/content/hero-notes.mjs`.
- В словаре ровно 37 записей: 36 `hero.<slug>` из `REGISTER_02_HEROES_AND_POLITICS.md` + `king.oathkeeper`.
- Три Register-героя роли King (`tomas_gate`, `lord_aylen`, `ergen_cloud`) пока не входят в обычный recruitment runtime, но их подписи уже хранятся в словаре для будущего использования.
- `game/js/content/hero-notes-runtime.mjs` применяет подписи на presentation-слое, не мутируя authored Register и Event data.
- В `Отряде` подпись заменяет старый generic description выбранного героя.
- В `Поселении` подпись заменяет старый generic description на карточке найма.
- Presentation override специально работает поверх старых сохранений, где ранее сохранённый `description` мог содержать старый текст.
- Статусы, роль, происхождение, командная стоимость, assets и gameplay mechanics не меняются.

## Character compass

Эти подписи являются narrative character compass для последующей редакторской работы:

- геройские варианты событий должны вытекать из личности героя, а не только из шахматной роли;
- одинаковые проблемы разные герои должны замечать по-разному;
- будущие реплики не обязаны повторять подпись, но не должны ей противоречить;
- недоступный геройский вариант может намекать на характер героя и мотивировать его найти/нанять;
- шахматная роль определяет бой, личность определяет восприятие путешествия и внебоевые решения.

Этот пункт пока является **редакторским контрактом**; текущая feature не переписывает 500 Events заново.

## Safety

- никаких новых или заменённых assets;
- существующие вручную заменённые `piece_badge.png` не затрагиваются;
- экономика, Power, Battle Mercenaries, Player Identity/Chronicle и Endless Run не меняются;
- GitHub Actions не используются.

## Gate

`tests/hero-notes.cjs` проверяет:

- ровно 36 HERO-slug в Register 02;
- наличие заметки для каждого из них;
- отдельную запись Хранителя Клятвы;
- покрытие всех текущих recruitable heroes;
- загрузку runtime через journey bootstrap;
- применение к Roster и Settlement presentation.

Canonical gate остаётся `npm run gate:local` + Cloudflare exact-head SUCCESS, затем human acceptance перед merge.
