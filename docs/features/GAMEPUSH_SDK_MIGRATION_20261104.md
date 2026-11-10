# GamePush SDK — безопасная подготовка миграции (2026-11-04)

## Актуальное решение: однократный перенос метапрогресса VK (2026-11-04)

**Последнее решение владельца (заменяет приведённое ниже раннее решение о полном обнулении):** сохранить старую Мощь, Летопись, завершённые результаты и покупки/награды Арены; **не переносить активный забег и незавершённый бой Арены**. **Яндекс не трогать.** Production main и URL VK не изменять.

**Почему без GamePush Cloud:** согласно [документации GamePush](https://docs.gamepush.com/ru/docs/player/player-manager/) тип `gp.player.sync({ storage: 'platform' })` бесплатен, но **не поддерживается VK Games**. Вызов `storage:'cloud'` использует собственный бэкенд GamePush и расходует тарифицируемые запросы, поэтому здесь не применяется.

**Реализация в PR #172 (подлежит реальному VK acceptance):**

1. В режиме `?rpchess_gamepush=1` и только после GP `player.ready`, подтверждённого входа VK + VK Bridge доступно **чтение** старых `rpchess_v1_cloud_*` через проверенный прежний механизм сериализации/chunk/checksum. Старые ключи никогда не изменяются.
2. Из старого payload выделяются только `rating` (Power + receipts), `chronicle.history` (до 20 записей, уникальные runId), `arena.events` (победы/поражения/осколки/отряды/артефакты). Ключ `run` игнорируется; `arena.match` всегда `null`.
3. Результат синхронизируется в **отдельные** ключи VK Cloud `rpchess_gp_v2_manifest` + слоты `rpchess_gp_v2_[ab]_#`, с проверкой контрольной суммы и записью манифеста последней. Локально под GP `rpchess.gamepush.v2.*`. Никаких административных API и платных сервисов.
4. Отметка `migratedFromVK` находится в новом meta-payload + локальном v2 namespace. Если она уже есть — старые данные больше не импортируются; новые Power, Chronicle, Arena синхронизируются с тем же VK Cloud. Повторный запуск не дублирует события/забеги.
5. Если старое облако испорчено, новый слот недоступен, запись/проверка завершились ошибкой — **не трогать** старый прогресс, не устанавливать отметку об успешной миграции, дать возможность повторить.
6. Перед реальным запуском VK нужно проверить авторизацию GamePush + доступность read-only VK Bridge запросов в dev iframe, а также загрузку meta на втором устройстве. Тесты GitHub не заменяют реальный аккаунт VK.

**Границы:** сохраняется метастатистика, а не текущая партия; устройство-локальный GP забег продолжается только на том же устройстве; межустройственная синхронизация самой активной партии не входит в этот этап. Не использовать GP Guest для переноса VK-профиля; VK login обязателен.

**Файлы:** `game/js/gamepush-meta-sync.mjs` (проверяемая миграция и VK meta sync), `game/js/cloud-save.mjs` (read-only источник), `game/js/platform.mjs` (жёстко ограниченный доступ к legacy и v2 ключам), `game/js/reboot-foundation.mjs` (последовательность загрузки), `scripts/build.cjs`, `tests/cloud-save.cjs`.

**Текущее состояние:** код в feature-ветке; локальные unit/CI и реальный VK dev smoke должны завершиться успешно до приёмки. Старые тексты ниже сохранены как история решений и могут противоречить этой новой политике.


**Статус:** Web и Турнир приняты. VK-only meta migration реализована в отдельной ветке; CI и ручной VK тест — обязательны до release. Яндекс отложен.
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
- SDK trial с флагом включается на Web, VK и Яндекс Играх. При GP-флаге нельзя параллельно использовать VK Bridge для инициализации/рекламы/облачных сохранений; без флага остаётся прежняя интеграция.

Для Web preview `platform.init()` вызывает SDK-загрузчик. Он пробует официальные CDN GamePush, ждёт `player.ready`, сообщает состояние через `RPChessPlatform.gamepush.status`, посылает `gameStart` после начального bootstrap экранов и переадресует pause/resume в действующий lifecycle. Пробный адаптер рекламы распознаёт fullscreen/rewarded и присуждает статус `completed` для rewarded **строго при `true`**; без доступности возвращает `unavailable`.

**Важно:** standalone Web не показывает платформенные рекламные предложения. При GP-флаге `monetization.mjs` проверяет готовность SDK и фактический тип VK/Яндекс; рекламу отправляет только через GP, не VK Bridge. Реальные показы и награды на VK/Яндекс пока не приняты и не должны публиковаться до платформенного теста.

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

1. **Выполнено:** доверенный тестовый домен разрешён, preview развернут и SDK в состоянии `ready`. Проверка: https://github.com/mobigametim-bit/RPChess/actions/runs/41829083836.
2. **Выполнено:** владелец принял игру и Турнир; тест двух игроков https://github.com/mobigametim-bit/RPChess/actions/runs/41831886829.
3. Подключить площадки VK Games и Yandex.Games вручную в GamePush Project 31247. Секретные ключи вводить только в консоли платформ/GamePush, не в GitHub и не в чат.
4. Утвердить слой удостоверения личности: подписанный `gp.player.authToken` проверяется **только** в Cloudflare Worker с серверным Secret. Никогда не доверять клиентскому player ID.
5. **Реализовано для GP opt-in:** новый namespace `rpchess.gamepush.v2.*` в браузерном localStorage (включая первое чтение языка/настроек). В GP-режиме старые локальные записи не читаются и не удаляются, а VK cloud save отключён. Отдельная игровая генерация сохранений пока локальная, межплатформенная синхронизация ещё не подключена. В обычном режиме прежние данные/облако не меняются.
6. Переключить VK/Yandex рекламу на GamePush строго с one-shot наградами. Убрать дублирование старых API после подтверждения.
7. Выполнить playtest: standalone Web, VK desktop/mobile, Yandex ZIP, PWA, Ads; затем актуализировать соответствующую документацию **только в GitHub** и обсуждать merge. Notion не входит в обязательные условия (решение 10.11.2026).

## Технические изменения

- `game/js/gamepush-sdk.mjs`: официальный SDK loader, публичная конфигурация, ожидание player ready, lifecycle, интерфейс рекламы.
- `game/js/platform.mjs`: opt-in Web/VK/Yandex adapter, отдельное v2 localStorage, GP ads path без VK Bridge fallback, блокирование старого VK cloud исключительно в GP-режиме.
- `game/js/reboot-foundation.mjs`: отправка `gameStart` после первого bootstrap.
- `scripts/build.cjs`: включение JS в production packager.
- `tests/reboot-foundation.cjs`: минимальное расширение существующего regression contract.

## Источники

- https://docs.gamepush.com/ru/docs/get-start/getting-started/
- https://docs.gamepush.com/tutorials/game-with-own-backend/
- https://docs.gamepush.com/ru/docs/get-start/allowed-sites/

## Ограничения проверки

GamePush SDK готов на доверенном Web-origin; Web и Турнир проверены вручную. **Не проверены**: VK/Yandex SDK в реальном iframe, рекламные показы, серверная JWT-подпись GamePush, межустройственная синхронизация v2. Это пока не production-кандидат.


## Результаты ручной проверки и решение об обнулении (2026-11-04)

Пользователь проверил тестовый GamePush preview: основные режимы работают; в Турнире не происходил поиск живого соперника.

**Причина:** турнирный Worker допускал только GitHub Pages и старый портретный preview; GamePush Preview отсутствовал в ALLOWED_ORIGINS. Добавлен третий origin без удаления двух предыдущих. Существующий rpchess-tournament-preview используется и текущим HTML: меняется только CORS allowlist, не PvP логика и не хранилище. Расширен существующий live-smoke проверками CORS OPTIONS для разрешённых адресов и отказа неизвестным сайтам.

**Сохранения:** владелец разрешил не мигрировать старый прогресс VK/локальных клиентов. Новая GamePush-версия должна использовать новый namespace/версию состояния с чистым стартом при отдельно принятом релизе. Старые VK и Яндекс-сборки продолжают работать без удаления. Не импортировать старое VK cloud обратно после сброса. Нынешний клиентский Cloud Save остаётся до дальнейшего переключения платформ.

**Ограничение идентичности:** standalone GamePush SDK подтвердил ready и player-ready, но это ещё не подтверждённая сервером личность. Для будущих рейтинговых матчей потребуется серверная проверка подписи GamePush auth token. Сейчас Web Турнир работает в гостевом режиме, рейтинговые начисления для гостей отключены.


## Этап 2: VK / Яндекс и чистый старт — 2026-11-04

Владелец подтвердил: **«да, работает Турнир»**. Далее работаем с GP-платформами в той же feature-ветке. Никаких production merge/deploy пока не делаем.

- Включение SDK по URL только `?rpchess_gamepush=1`: без него прежний VK/HTML5/Cloud path не изменён.
- `game/js/gamepush-sdk.mjs` даёт `platformType`, `playerId`, `loggedIn` для UI, **не доверять** таким полям на сервере без проверки JWT.
- `game/js/platform.mjs`: GP-режим использует только GP bootstrap и GP ads (без параллельного VK Bridge); legacy VK storage недоступен. При отсутствии GP-флага старые вызовы VK Bridge сохраняются.
- `game/js/content/monetization.mjs`: Gate рекламных предложений GP только при `ready` и host VK/Yandex. Награда за rewarded только при `success === true`; дедупликация остаётся в текущих receipts.
- `game/index.html`: язык/фантазийные фигуры на первом кадре читаются из соответствующего GP v2 namespace.
- Граница сохранений: `rpchess.gamepush.v2.*` — **изолировано и сохранится после перезапуска браузера**, но пока не облако и не синхронизация между устройствами. Старые записи физически НЕ удаляются. Все совместные данные турнирного сервера сохраняются в отдельном Worker, который здесь не пересоздаётся.
- CI GamePush preview дополнен проверкой того, что seed legacy-run остаётся целым, GP его не видит, а новые записи попадают только в v2 namespace.

**Дальнейшие шаги:** после CI пройти VK Dev/GamePush и Yandex Dev/GamePush connection без копирования секретов в код; протестировать на платформенных стендах рекламу, старты и сохранения; затем подготовить серверное подтверждение GamePush JWT для рейтингового Турнира. Чистый старт уже согласован, отдельного импорта legacy VK делать не нужно.

## VK Games — подготовка реального dev-теста (2026-11-04)

**Владелец подтвердил:** VK Games подключён в GamePush Project ID 31247. **Яндекс Игры отложены — в этом цикле не трогать.**

- VK app ID: `54754579`. Канонический production URL: `https://mobigametim-bit.github.io/RPChess/`. Текущий production/deploy contract в `docs/platforms/DEPLOYMENT_CONTRACT.md` — не переходить на VK Hosting без согласования.
- **Отдельная dev-сборка:** `https://rpchess-gamepush-preview.mobigametim.workers.dev/?rpchess_gamepush=1`. Это единственная тестовая ссылка, не менять production URL, `main`, VK Hosting, VK-модерацию и Yandex.
- [Официальный пример VK по адресу разработки](https://github.com/VKCOM/vk-mini-apps-course-frontend): в dev.vk.com / управлении приложением `54754579` включить режим разработки для нужной версии и установить **URL для разработки**, а не production URL. Начать с VK Web (desktop). При наличии отдельной группы тестирования использовать её, не затрагивая массовую аудиторию. Владельцу потребуется вручную открыть приложение `https://vk.com/app54754579`.
- На VK Web проверить DevTools: `window.RPChessPlatform.gamepush.enabled === true`, `status === 'ready'`, `platformType` соответствует VK (не WEB), `storage.cloud.available === false`; не снимать и не пересылать `authToken`/подписанные `vk_*` launch params.
- Проверить первый чистый старт, окно короля, Путешествие, Стычку, Арену, Турнир, сохранение/reload в пределах одного устройства.
- Пока нет отдельного полноценного backend/save adapter, новый GP прогресс хранится в `rpchess.gamepush.v2.*` локально. Его нельзя выдавать за облачное сохранение или перенос между устройствами.
- Rewarded: не давать золото при отмене/недоступности рекламы; статус completed только при `success === true`. Сначала проверить настройку и доступность AppsCentrum/VK; SDK сам выбирает провайдера, не дублировать VK Bridge; не покупать ничего.
- После теста вернуть дев-URL при необходимости. При любом падении SDK — зафиксировать `status`, `platformType` и ошибку из Console без секретов, передать скриншот. От владельца не нужны секреты или токены.

Стадия разработки: в feature-ветке дополнительно защищены все прямые методы прежнего VK cloud storage и актуализированы capabilities; минимальный VK regression в `tests/cloud-save.cjs` утверждает, что legacy прогресс остаётся прежним, даже если GP-вариант создаёт новый run. До PASS GitHub Actions последнего коммита не маркировать этап как принятый.


## 2026-11-05 — VK реклама: проверяем GamePush без потери доходных показов

**Внешнее подтверждение:** VK Developers показывает статистику рекламных показов для приложения `54754579`, в том числе Interstitial и Rewarded за октябрь–ноябрь. Это подтверждает работу текущей интеграции VK, **но не доказывает**, что именно GamePush сейчас является источником вызова рекламы: production использует VK Bridge.

**Изолированный эксперимент PR #174** (база — черновой PR #173, `main`/production VK не менять):
- При `?rpchess_gamepush=1` GamePush остаётся **единственным** провайдером рекламы, пока SDK загружается или работает успешно. Если SDK возвращает отсутствие рекламного инвентаря, отмену либо ошибку отдельного показа, НЕ переключаться на Bridge в рамках этого показа: этим предотвращаются обход частотных лимитов и двойной вызов.
- Только если инициализация SDK терминально завершилась `unavailable` **и подтверждено реальное VK-окружение** (VK referrer, VK native handler или ответ доверенного VK iframe), допускается резервный `VKWebAppShowNativeAds`. Наличия одного `vk_app_id` в URL недостаточно. Нативная инициализация запускается только после неуспеха GP, не параллельно.
- В отдельном Web/PWA без подтверждённой VK/Yandex платформы реклама отключена. Получение Rewarded `completed` требует строгого `true` от GamePush либо `result===true` от VK Bridge. При отмене, ошибке, отсутствии объявления — никаких бонусов. Параллельные попытки показа отсечены на общем адаптере.
- Игровые рецепты/проверки удвоенного золота и спасения припасами не меняются, существующие `adRewardClaims` и receipts защищают от повторных начислений. Если GP отказывает после уже показанного окна победы, доступная резервная реклама может восстановить только кнопку ×2 без автоматического начисления.
- Диагностика без секретов: `window.RPChessPlatform.gamepush.diagnostics`, `window.RPChessPlatform.gamepush.failureCode`, `window.RPChessPlatform.ads.diagnostics`; последнее поле содержит `backend` (`gamepush`/`vk-bridge`/`none`), `sdkStatus`, `vkHostConfirmed`. Не отправлять `authToken`, VK protected key, содержимое `sign`, исходные параметры запуска.
- Контракт регрессии: `npm run test:gamepush:ads`, существующие `tests/monetization.cjs` и `gate:local`, Chromium и живая Web-страница. Для просмотра **внутри VK через настроенный URL разработки** используйте `https://rpchess-gamepush-preview.mobigametim.workers.dev/?rpchess_profile=1&rpchess_gamepush=1`. Вне VK реальной нативной рекламы быть не должно.

**Оставшийся внешний блокер:** ошибка GamePush VK `400 invalid player data: userId not found` может быть связана с настройками VK Games App ID/Protected Key, источником открытия iframe или серверной авторизацией провайдера. Сам код SDK не может изменить настройку GamePush на сервере: если `failureCode='vk-player-auth'`, владелец проверяет в панели GamePush → Платформы → VK Games корректность App ID `54754579` и сохранённость защищённого ключа (не копировать значение в чат). Для **доказательства реального показа через GamePush** необходима проверка `ads.diagnostics.backend==='gamepush'` во время удачной VK-сессии, а не только график рекламы VK.

**Приёмка VK desktop + Android:** SDK ready/failed → источник рекламы; Rewarded полностью/закрыть/нет объявления; ×2 золота ровно один раз; спасение 5 припасами ровно один раз; fullscreen на пятом шаге без двойного показа; повторная загрузка без повторных начислений; прогресс D1 неизменен. После проверки владельцем только затем планировать main/релиз.
