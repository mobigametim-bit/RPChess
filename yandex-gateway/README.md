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
