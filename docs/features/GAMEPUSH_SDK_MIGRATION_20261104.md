# GamePush SDK — безопасная подготовка миграции (2026-11-04)

**Статус:** IMPLEMENTED + CI PASS + ISOLATED PREVIEW DEPLOYED; GAMEPUSH SDK AUTH NOT YET LIVE-VERIFIED; NOT HUMAN ACCEPTED.
**Ветка:** `feature/gamepush-sdk-foundation-20261104`. **Production `main` и действующие VK/Яндекс публикации не изменять.**

## Цель и границы

- Добавить официальный GamePush JavaScript SDK для будущего единого платформенного слоя.
- Сохранить каноническую игру на GitHub Pages и отдельные Workers / Durable Objects для Турнира.
- Не использовать платные GamePush Backend функции, GraphQL Admin API, игровые хранилища и GamePush Hosting.
- Не менять пользовательские сохранения, идентификаторы, рекламные награды, платформенные настройки или текущий VK Bridge до отдельного playtest.
- Не размещать в клиенте Project Secret / API-ключи / Cloudflare secrets.

## Конфигурация

- GamePush project ID: `31247`.
- Public Token: находится в `game/js/gamepush-sdk.mjs` (публичный клиентский параметр).
- Включение тестового SDK: `?rpchess_gamepush=1` на доверенном тестовом origin.
- Без этого флага загрузчик не делает запросов к SDK и платформа работает прежним способом.
- SDK trial сейчас **только для standalone Web**: при VK launch остаётся старая интеграция VK Bridge даже с query-флагом.

Для Web preview `platform.init()` вызывает SDK-загрузчик. Он пробует официальные CDN GamePush, ждёт `player.ready`, сообщает состояние через `RPChessPlatform.gamepush.status`, посылает `gameStart` после начального bootstrap экранов и переадресует pause/resume в действующий lifecycle. Пробный адаптер рекламы распознаёт fullscreen/rewarded и присуждает статус `completed` для rewarded **строго при `true`**; без доступности возвращает `unavailable`.

**Важно:** обычный Web-режим RPChess не показывает рекламные предложения на экранах, потому что `monetization.mjs` сейчас активирует их только в контексте VK. Это намеренно: нельзя включить новые награды до аудита и приёмки на площадках.

## Проверка независимого preview (2026-11-04)

- Worker: `rpchess-gamepush-preview` (новый отдельный Worker со статическими assets; Tournament, leaderboard, RPChess main Worker не менялись).
- Обычный тестовый адрес: https://rpchess-gamepush-preview.mobigametim.workers.dev/
- **SDK trial URL:** https://rpchess-gamepush-preview.mobigametim.workers.dev/?rpchess_gamepush=1
- Actions run: https://github.com/mobigametim-bit/RPChess/actions/runs/41826383331 — **SUCCESS**.
- `npm run gate:local` — PASS; `portrait-key-scenes-browser.cjs` — PASS.
- Cloudflare Wrangler: загружены 957 файлов, выдан публичный Worker URL.
- Live HTTP проверка: возвращаются HTML и `js/gamepush-sdk.mjs`; Chromium на опубликованном адресе подтверждает меню, `enabled:true`, `projectId:31247`.
- Снимок сразу после загрузки: `status:"loading"`; **не означает подтверждённую авторизацию**. Установить исход в доверенных сайтах GamePush и пометить тестовым; затем проверить `status:"ready"` на реальной странице.
- `main`/GitHub Pages/VK/Яндекс/Cloudflare Tournament API не менялись.
- Workflow: `.github/workflows/gamepush-preview.yml`, config: `gamepush-preview/wrangler.toml`.

## Что осталось до реального переключения площадок

1. Пользователь добавляет **тестовый origin** `https://rpchess-gamepush-preview.mobigametim.workers.dev` в GamePush → Allowed Sites / Доверенные сайты, включает Allow и Test/Dev. Не трогать Production URL.
2. Создать preview-развёртывание этой ветки (через существующий staging/Netlify, без GitHub Pages production).
3. В Chrome / DevTools проверить статус `RPChessPlatform.gamepush.status === 'ready'`; при недоступности SDK игра должна продолжать работать. Не публиковать токены авторизации.
4. Утвердить слой удостоверения личности: подписанный `gp.player.authToken` проверяется **только** в Cloudflare Worker с серверным Secret. Никогда не доверять клиентскому player ID.
5. Спроектировать сохранение прежних VK cloud saves: резервная копия, выбор при конфликте и явное подтверждение миграции. Пока не мигрировать.
6. Переключить VK/Yandex рекламу на GamePush строго с one-shot наградами. Убрать дублирование старых API после подтверждения.
7. Выполнить playtest: standalone Web, VK desktop/mobile, Yandex ZIP, PWA, Ads; потом синхронизировать GitHub Docs и Notion, только затем обсуждать merge.

## Технические изменения

- `game/js/gamepush-sdk.mjs`: официальный SDK loader, публичная конфигурация, ожидание player ready, lifecycle, интерфейс рекламы.
- `game/js/platform.mjs`: opt-in Web integration; VK path сохранён без изменений.
- `game/js/reboot-foundation.mjs`: отправка `gameStart` после первого bootstrap.
- `scripts/build.cjs`: включение JS в production packager.
- `tests/reboot-foundation.cjs`: минимальное расширение существующего regression contract.

## Источники

- https://docs.gamepush.com/ru/docs/get-start/getting-started/
- https://docs.gamepush.com/tutorials/game-with-own-backend/
- https://docs.gamepush.com/ru/docs/get-start/allowed-sites/

## Ограничения проверки

Подпись JWT, живые вызовы SDK на доверенном origin, реклама в VK/Яндекс, серверная миграция аккаунтов и визуальный playtest **не выполнены**. SDK не должен считаться готовым к production на основании одного исходного кода.
