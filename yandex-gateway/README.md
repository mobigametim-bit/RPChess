# Проверка Yandex API Gateway для RPChess

## Результат живой проверки — 2026-11-06

Пользователь создал API Gateway с публичным служебным адресом:
`https://d5ds3hf0ei1mlkgjrnlm.d8epmcec.apigw.yandexcloud.net`

**[GitHub Actions проверка #42231590821](https://github.com/mobigametim-bit/RPChess/actions/runs/42231590821) — SUCCESS:**

- DNS: внешний GitHub Runner успешно определил IPv4.
- `GET /ping` → **HTTP 200**, `via=yandex-api-gateway`.
- `GET /probe/profile` → **HTTP 200**, `service=rpchess-profile-preview`.
- `GET /probe/tournament` → **HTTP 200**, `service=tournament`.

Это подтверждает доступность публичного шлюза из внешней сети и HTTPS-доступ к обоим Workers **из инфраструктуры Yandex API Gateway**. Но ещё **не** доказывает доступ из российских домашних/мобильных сетей и полноценное проксирование клиентских POST/PUT/CORS, игровых сессий и матчмейкинга. Эти тесты обязательны до изменения игрового клиента.

## Следующий этап

1. Вручную из РФ без VPN открыть эти три URL и подтвердить ответы.
2. Разработать отдельную версию **только API gateway** (без игровых файлов) с строго разрешёнными маршрутами, корректной передачей `Authorization`, `Origin`, `Content-Type`, `GET`, `POST`, `PUT`, `OPTIONS`, тела запроса и CORS, сохранив существующие Workers.
3. Протестировать реальную пару игроков и сохранение/восстановление профиля без VPN. Отделить гостевой тест (без рейтинга) от VK-rated.
4. Оставить основную игру на GitHub Pages/ВК; `main` не менять без прямого разрешения пользователя.


**Статус:** подготовлена конфигурация теста, но ни один ресурс Yandex Cloud не создан. У нас нет подключения к аккаунту Yandex Cloud. `main`, Netlify и действующие Cloudflare Workers не изменены.

Цель: выяснить, получится ли заменить нестабильный Netlify-шлюз российским Yandex API Gateway **только для HTTP API**. Все игровые файлы остаются на GitHub Pages / ВК. До успешного теста не подключать Yandex Gateway к игровому клиенту.

## Сначала три безопасные GET-проверки

Спецификация: [probe.openapi.yaml](./probe.openapi.yaml). Она содержит только:

| Путь | Что проверяет | Ожидаемый JSON |
| --- | --- | --- |
| `/ping` | устройство в РФ → Yandex API Gateway | `{"ok":true,"via":"yandex-api-gateway"}` |
| `/probe/profile` | Yandex API Gateway → Cloudflare Profile Worker | `{"ok":true,"service":"rpchess-profile-preview",...}` |
| `/probe/tournament` | Yandex API Gateway → Cloudflare Tournament Worker | `{"ok":true,"service":"tournament",...}` |

Никакой авторизации, пользовательских данных, игровых POST/PUT и нагрузки на матчмейкинг в первом этапе.

## Что делает владелец Yandex Cloud

1. Зайти в https://console.yandex.cloud и выбрать облако/каталог. Проверить, что платежный аккаунт активен: Yandex Cloud может требовать привязку платежного аккаунта даже для бесплатного объема.
2. Открыть **API Gateway** → **Создать API-шлюз**. Имя: `rpchess-api-network-probe`.
3. В поле **Спецификация** вставить **весь текст** `probe.openapi.yaml` (не ссылку), не добавляя никакие токены/секреты. Никакого VPC/сервисного аккаунта для общедоступного GET /health не требуется.
4. Создать ресурс, скопировать **Служебный домен** (вида `https://<id>.apigw.yandexcloud.net`).
5. Из России с выключенным VPN последовательно открыть `<Служебный домен>/ping`, `<Служебный домен>/probe/profile`, `<Служебный домен>/probe/tournament`; записать HTTP-статус и JSON, не раскрывая аккаунтных данных.
6. Передать публичный служебный домен и результаты тестов для дальнейшей проверки из GitHub Actions и репетиции браузерных CORS/POST/PUT. Служебный домен публичный, не токен.

Альтернативно тест из CLI:

```sh
node tests/yandex-gateway-health-probe.mjs https://<ваш-id>.apigw.yandexcloud.net
```

## Как интерпретировать результаты

- `/ping` недоступен из РФ → Yandex не решает исходную задачу для этой сети.
- `/ping` работает, а один или два `/probe/*` нет → доступность Yandex проверена, но обращение к Cloudflare Worker из облака не подтверждено; не менять игровой клиент.
- Все три GET-эндпоинта успешны → разрешено **только проектирование второго этапа**: HTTPS-прокси `/profile/*`, `/tournament/*`, тест сохранения `Origin` и `Authorization`, preflight CORS, методы POST и PUT, корректность body/ответов и два реальных клиента. Финальная конфигурация должна явно настроить передачу оригинальных заголовков: документация `x-yc-apigateway-integration:http` говорит, что по умолчанию заголовки (кроме User-Agent) и query-параметры **не передаются**. Кроме того, требуется проверить, не нарушается ли CORS ответ от существующих Workers.
- Не изменять `main` до отдельного согласования.

## Тарифы / ограничения, проверено по официальным документам 2026-11-06

- 100 000 запросов к Yandex API Gateway за календарный месяц без тарификации; далее 142,30 ₽ за миллион запросов для РФ. Первые 100 ГБ исходящего трафика без тарификации (далее платно). Открытие платежного аккаунта требуется по инструкции быстрого старта.
- По умолчанию шлюз работает в изолированной IPv4-сети с NAT и может обращаться к публичным IPv4. Существующие workers.dev публичные, но доступ по HTTPS из сети Яндекса нужно подтвердить живым тестом.
- Не включать в одном эксперименте реальные профили, турнирный рейтинг, смену основного API в VK или передавать секреты; запрещено автоматически повторять неоднозначные POST.

Официальная документация:
- https://yandex.cloud/ru/docs/api-gateway/operations/api-gw-create
- https://yandex.cloud/ru/docs/api-gateway/concepts/extensions/http
- https://yandex.cloud/ru/docs/api-gateway/concepts/networking
- https://yandex.cloud/ru/docs/api-gateway/pricing
- https://yandex.cloud/ru/docs/api-gateway/quickstart/


## Этап 2: живое тестирование — подтверждено 2026-11-06

Владелец установил `proxy.openapi.yaml` в существующий шлюз. Выполнены тесты [safe + isolated guest e2e](https://github.com/mobigametim-bit/RPChess/actions/runs/42241522118), оба задания **SUCCESS**:

1. `GET /ping`, `/probe/profile`, `/probe/tournament`, `/profile/health`, `/tournament/health` → HTTP 200.
2. CORS preflight из `https://mobigametim-bit.github.io` к Profile POST/PUT и Tournament POST → HTTP 204, правильный `Access-Control-Allow-Origin`.
3. Незнакомый `Origin` `https://example.invalid` отклонён upstream HTTP 403; запрос `PUT` без авторизации отклонён HTTP 401.
4. Создан отдельный гостевой профиль, получен токен (не печатался в логах), выполнен настоящий `PUT /profile/v1/profile` с revision и GET-чтение сохранённого snapshot — **PASS**.
5. Две отдельные гостевые сессии Турнира, приватная комната, подключение второго игрока, ходы e2-e4 и e7-e5, восстановление состояния, сдача; **rated=false**, общий поиск игроков и Elo не затронуты.

**Что всё ещё не подтверждено:** браузерное CORS из реального GitHub Pages/VK, доступность всех новых путей `/profile/health` и `/tournament/health` из РФ без VPN (старые `/probe/` подтверждены), автоматический выбор шлюза из игры и матч двух реальных клиентов. Эти проверки нужны до `main`.

**Дальнейший шаг:** подготовить отдельную тестовую интеграцию RPChess JS transport с Yandex URL, без файлов игры на Yandex, и передать ссылку на игру в настоящем GH/VK-окружении. Не объединять с `main` без явной ручной приёмки.

## Этап 2: Yandex API Gateway как только HTTP-прокси

**Статус:** подготовлено к установке владельцем в существующий Yandex API Gateway. Ничего в Yandex Cloud автоматически не обновлено — доступ к аккаунту не подключён. Этап 1 уже подтверждён из России без VPN.

Текущая спецификация: [proxy.openapi.yaml](proxy.openapi.yaml). Она полностью заменяет содержимое поля спецификации, **не удаляя** предыдущие `/ping` и `/probe/*`, и добавляет только два префикса API:
`/profile/{profilePath+}` и `/tournament/{tournamentPath+}`.

- `x-yc-apigateway-any-method` пересылает исходный метод запроса; текущие Workers сами ограничивают его (Profile: GET/POST/PUT/OPTIONS, Tournament: GET/POST/OPTIONS).
- `headers: {'*':'*'}` сохраняет `Origin`, `Authorization`, `Content-Type` и CORS preflight; явный `Host` устанавливает правильный Cloudflare Worker.
- `query: {'*':'*'}` сохраняет query-параметры. Без двух wildcard-полей Yandex Cloud их не пересылает по умолчанию, что ломает авторизацию и CORS. [Официальная инструкция](https://yandex.cloud/ru/docs/api-gateway/concepts/extensions/http).
- Не используем `origin: true` или `Access-Control-Allow-Origin: '*'` в Яндексе: исходный `OPTIONS` передаём Worker, который проверяет разрешённые origins, и возвращает браузеру только согласованный `Access-Control-Allow-Origin`. [Yandex CORS](https://yandex.cloud/ru/docs/api-gateway/concepts/extensions/cors).
- Запросы проксируются **только** к двум фиксированным Worker URL. Нет размещения игры, базы данных, лобби или секретов в Яндексе.
- Существующий Web/VK RPChess не перенастраиваем до результатов реальных браузерных тестов и отдельного подтверждения пользователя. `main` не трогаем.

### Действие владельца

1. [Yandex Cloud Console](https://console.yandex.cloud/) → каталог → API Gateway → `rpchess-api-network-probe` → **Редактировать**.
2. Заменить **всё содержимое** поля **Спецификация** содержимым `proxy.openapi.yaml`, нажать **Сохранить**. Не вставлять ключи API и не создавать новых ресурсов.
3. Проверить из России без VPN:
   - `https://d5ds3hf0ei1mlkgjrnlm.d8epmcec.apigw.yandexcloud.net/profile/health` → `"ok":true, "service":"rpchess-profile-preview"`;
   - `https://d5ds3hf0ei1mlkgjrnlm.d8epmcec.apigw.yandexcloud.net/tournament/health` → `"ok":true, "service":"tournament"`.
4. После подтверждения обновлённой спецификации запустить безопасный тест:
   `node tests/yandex-gateway-proxy-smoke.mjs`.
5. **Только если безопасный тест пройден**, протестировать реальную гостевую закрытую партию:
   `node tests/yandex-gateway-private-match-smoke.mjs`.
6. После двух зелёных тестов проверить сам игровой клиент с двух устройств в РФ, включая восстановление после обновления страницы, и отдельно профиль PUT с валидным гостевым токеном.
7. Только после приёмки перенести клиентскую маршрутизацию на новый Yandex Gateway в отдельной ветке/PR.

### Откат

В любой момент можно вернуть старую `probe.openapi.yaml` в поле спецификации. Откат не затрагивает данные, Worker, Netlify, `main` и игровые ассеты.

### Нерешённые риски

- Передача HTTP body, заголовков, методов и preflight требует живого теста после установки. Подготовленная YAML корректно описывает ожидаемую интеграцию по документации, но ещё не прошла серверную валидацию в Yandex Cloud.
- При изменении набора разрешённых браузерных origins (VK/GitHub Pages) нужно проверить актуальный allowlist Workers; **не включать отражение любого Origin** в Яндексе.
- Турнир опрашивает сервер примерно раз в 2.4 секунды: при росте онлайна нужно мониторить бесплатный лимит вызовов шлюза и стоимость.


## Этап 3 — клиентский маршрут (подготовка 2026-11-06)

В экспериментальной ветке добавлен `game/js/api-route.mjs` и два узких изменения `profile-client.mjs` / `tournament-app.mjs`. Этот общий селектор выбирает путь к обоим Workers до начала авторизованных запросов: `auto` — два коротких GET health к прямым Workers, только при успешности обоих выбираем `direct`, иначе `yandex`. В режиме проверки `?rpchess_api_route=yandex` можно принудительно включить российский шлюз, `?rpchess_api_route=direct` — исходную маршрутизацию. Токены никогда не записываются в URL. После неоднозначного POST/PUT нет автоматического повтора через второй провайдер.

Для теста без отдельного хостинга игры добавим браузерную проверку GitHub Pages с подстановкой только этих трёх новых JS-модулей в Playwright. Ветки/репозитории и основная публикация GitHub Pages/VK не меняются. Прямой браузерный тест из РФ с настоящего клиента потребуется перед слиянием.

