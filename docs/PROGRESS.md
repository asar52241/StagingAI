# Прогресс: системные правки StagingAI

Трекер по плану из `~/.claude/plans/unified-scribbling-candy.md` (деньги, хостинг, данные, закон). Обновлять при каждой сессии.

## Фаза 0 — серверная квота (закрывает утечку денег)

- [x] `lib/orders.ts` — `ensureOrder`/`consumeOrder` на Upstash Redis, атомарный инкремент через Lua
- [x] `app/api/payment/result/route.ts` — пишет заказ при вебхуке Робокассы
- [x] `app/api/payment/status/route.ts` — идемпотентно создаёт заказ, cookie несёт только `invId`
- [x] `app/api/declutter/route.ts` — списывает 1 фото из квоты вместо простой проверки подписи
- [x] Квота списывается только после полной валидации загрузки, непосредственно перед вызовом OpenAI; некорректная форма не сжигает оплаченный запуск
- [x] `lib/robokassa.ts` — `signPaidToken`/`verifyPaidToken` упрощены до одного `invId`
- [x] `config/legal.ts` — `minPhotosPerOrder: 3 → 1`
- [x] Живой тест `lib/orders.ts` на реальном Upstash — квота считается верно, идемпотентность подтверждена

## Фаза 1 — rate-limit

- [x] `lib/rateLimit.ts` — hash(IP) + TTL в Redis, применяется к `/api/payment/create`
- [x] Убран бесполезный in-memory `Map` из `declutter/route.ts`

## Фаза 2 — юр.тексты в соответствие факту

- [x] `resultStorageHours` (враньё про хранение 24ч) убран из `config/legal.ts`, `/refund`
- [x] `docs/data-minimization.md`, `/privacy` — добавлены абзацы про заказы в Redis и IP-хэш

## Фаза 3 — хостинг

- [x] Обнаружен реальный деплой: https://staging-ai-gamma.vercel.app (прод, старая версия кода без Upstash)
- [ ] Смёрджить `fix/server-side-quota` в основную ветку и задеплоить
- [ ] Добавить `UPSTASH_REDIS_REST_URL/TOKEN`, актуальные `ROBOKASSA_*` в переменные окружения Vercel-проекта
- [x] Подтверждён жёсткий лимит Vercel Function 4.5MB на request/response; фронтенд сжимает изображения до 3.5MB, сервер ограничивает маску 512KB, ответы запрашиваются в WebP
- [ ] Если потребуется принимать оригиналы больше 4.5MB: добавить прямую загрузку в object storage (например, Vercel Blob client uploads) и передавать в `/api/declutter` URL/Blob reference
- [ ] Перевести на Vercel Pro (Hobby нарушает ToS для коммерции с реальными платежами)

## Фаза 4 — Batch API / эконом-тариф

- [ ] Отложено. Возвращаться только при реальном давлении на маржу (см. план)

## Побочные находки (вне плана, обнаружены при тестировании оплаты)

- [x] **Баг: двойное URL-кодирование `Receipt`** в `lib/robokassa.ts` — исправлено (`buildPaymentUrl` больше не гоняет уже закодированную строку через `URLSearchParams.set()`/`new URL()`)
- [x] **Решено: ошибка 29 у Робокассы при наличии `Receipt`** — причина: `Receipt` не должен входить в базу подписи, вопреки документации Робокассы. Формула `login:outSum:invId:password1` (без Receipt) принимается магазином даже когда сам `Receipt` присутствует в запросе. Исправлено в `lib/robokassa.ts` (`buildPaymentUrl`). См. `docs/robokassa-receipt-issue.md`

## Инфраструктура для тестов (уже настроено)

- Upstash Redis — аккаунт заведён, `.env.local` заполнен, живой тест прошёл
- Robokassa — тестовые пароли получены из кабинета и подтверждены рабочими (без `Receipt`)
- MCP-сервер `robokassa` (https://mcp.robokassa.ru/mcp) подключён в `/Users/aleksandr/Desktop/AI/projects/avito/StagingAI` (project-scoped) — использовать из сессии, запущенной именно в этой папке
