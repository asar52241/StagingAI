# StagingAI

Next.js 16 + React 19 + TypeScript application for automatic decluttering and masked editing of real-estate photos.

## Run locally

Requires Node.js 20.9+ and npm (Node.js 22/24 recommended).

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Fill in the OpenAI key, Robokassa credentials and `PAYMENT_TOKEN_SECRET` (random, at least 32 characters). Generate a secret with `openssl rand -hex 32`. Never commit `.env.local`. For local payment return URLs, set `NEXT_PUBLIC_SITE_URL=http://localhost:3000`.

When `ROBOKASSA_TEST=true`, **separate** test passwords are required; production passwords are never used as a fallback. Local development uses an in-memory order store unless `DATABASE_URL` is configured. Restarting it invalidates local orders. Use a separate Neon database/branch for local development. Test payments still invoke the paid image provider when using the application manually.

## Payment and processing

1. `/api/payment/create` validates an integer photo count (1–30), calculates the advertised package price, stores the order and sets an HttpOnly owner cookie.
2. Configure Robokassa's ResultURL as `https://YOUR_DOMAIN/api/payment/result`. The signed callback persists payment before responding `OK{InvId}`. Configure the merchant signature algorithm as MD5 and the standard success/failure addresses as `/studio?paid=true` and `/studio?paid=false`, using GET. The merchant-verified payment signature excludes `Receipt`; the receipt and configured `SuccessURL`/`FailURL` are encoded once. See [the receipt investigation](docs/robokassa-receipt-issue.md).
3. `/api/payment/status` requires the order's owner cookie. In live mode, an unconfirmed order is checked through OpStateExt, including the exact merchant `OutSum`. Test mode requires a valid SuccessURL signature or a previously verified ResultURL. Browser-supplied amounts never grant credits.
4. Payment access lasts 24 hours from the first confirmation, bounded by the order's seven-day lifetime. Rechecking a payment never resets expiry or spent attempts.
5. Each distinct source photo can be processed twice (initial attempt + one retry). The number of distinct sources is limited by the order. Reservations are atomic across server instances. Provider errors/timeouts also consume an attempt because billing may already have occurred. Automatic SDK retries are disabled.

The order must be resumed in the same browser. One pending checkout cookie is retained per browser. Already confirmed orders retain their separate paid cookie. Identical source files share the same two-attempt allowance. Sources/masks and results stay in browser IndexedDB; completed photos are restored without automatic regeneration. A new order can be started explicitly in the studio.

## Production configuration

The current production origin is `https://staging-ai-gamma.vercel.app`. Set `NEXT_PUBLIC_SITE_URL` to that exact origin in Vercel Production, then rebuild/redeploy: Next.js freezes this value at build time. Checkout rejects browser requests from any other origin. When moving to a custom domain, update this variable and Robokassa's callback/return URLs together.

Set `DATABASE_URL`, `PAYMENT_TOKEN_SECRET`, `NEXT_PUBLIC_SITE_URL`, OpenAI and Robokassa credentials on **every** instance. Orders and rate limits use persistent PostgreSQL through the Neon HTTPS driver. Redis is no longer required. `POSTGRES_URL` is accepted as a fallback name when `DATABASE_URL` is empty. Storage outages return errors and do not grant processing. The application deliberately refuses production checkout/processing without persistent storage.

### Connect Neon on Vercel

1. Connect the Neon integration to the StagingAI Vercel project for **Production**, with the custom prefix `DATABASE` (the resulting connection variable is `DATABASE_URL`). Leave database branching for production deployments disabled so deployments share paid orders. Use separate databases/branches and test payment credentials for Preview/Development.
2. Confirm that `DATABASE_URL` contains the pooled PostgreSQL connection string in Vercel's server-side environment variables. Do not use a `NEXT_PUBLIC_` prefix. The additional `PG*` variables and unpooled URL are not needed by this application.
3. Before deploying, run `npm run db:setup` in an environment containing that `DATABASE_URL`, or execute [db/001_order_store.sql](db/001_order_store.sql) in Neon's SQL Editor. The command also reads Next.js local env files. It creates only the application's `public.stagingai_records` table and expiry index and can be re-run without clearing data. The demo `comments` table/form shown by the integration is not used.
4. Deploy the updated application. Confirm checkout, signed callback and owner-only recovery in the deployed environment.

Updates use conditional SQL writes, preserving quota under concurrent Vercel invocations. Expired records are immediately treated as absent. During writes, each active instance deletes up to 1,000 expired records at most once per minute; physical deletion therefore happens during subsequent traffic, not exactly at expiry. No images are stored in PostgreSQL.

If a database password was shared in a chat or screenshot, rotate it using **Neon → Connect → Reset password**, confirm the updated connection credentials in Vercel, then deploy. See [Vercel's rotation instructions](https://vercel.com/kb/guide/how-to-reset-a-secret-for-a-neon-integration). A reset immediately invalidates the old credentials.

For a custom reverse proxy, set `TRUSTED_IP_HEADER` only if that proxy strips and replaces the header. Vercel's `x-vercel-forwarded-for` is selected automatically; otherwise checkout uses a shared rate bucket. Photo processing also has an order-based rate limit. Apply host-level connection/body limits appropriate to the deployment; a hosting provider may impose a lower upload limit than the application.

Before replacing the old payment implementation, finish existing paid orders or arrange manual fulfilment: legacy MD5 paid cookies and invoices absent from the new store are intentionally rejected. Verify a complete Robokassa checkout/callback/return in the deployment environment before accepting new live payments. This repository's automated tests use mocked providers, not live payments.

## Image API

`POST /api/declutter` takes multipart form data and a valid `sa_paid` HttpOnly cookie:

- `image`: JPEG/PNG, up to 3.5 MiB, maximum side 3000 px.
- `mode`: `mask` (default) or `auto`.
- `mask`: required for `mask`; PNG with alpha/transparency support, same dimensions, up to 512 KiB.
- `output_format`: `png` (default), `jpeg`, `webp`.
- `quality`: `high` (default), `medium`.

The browser accepts JPEG/PNG/WebP/GIF and always re-encodes before upload, stripping metadata. Small WebP/GIF inputs are converted to PNG; large images are compressed to JPEG and reduced in size to fit the 3.5 MiB upload budget. Animated files produce a still image. The studio requests WebP results to reduce response size. The request body is bounded while streaming (4 MiB + 64 KiB, 30-second upload deadline), before multipart parsing. Images are forwarded with fixed filenames. Generated images and API responses use `Cache-Control: no-store`.

## Checks

```sh
npm run typecheck
npm test
npm run build
npm audit
# Install a Playwright browser once, or use an existing Chrome:
PLAYWRIGHT_CHANNEL=chrome npm run test:browser
```

Unit tests clear database credentials before loading application modules. PostgreSQL tests run the real migration and storage queries against an isolated in-memory PostgreSQL engine (PGlite); they do not use Neon or make payments. Browser tests run a local server with dummy credentials and intercept all payment/image requests. They never make real payments or invoke image generation. On machines without Chrome, run `npx playwright install chromium` then `npm run test:browser`.

Next.js 16 uses Turbopack for development and production builds. Production verification uses a copy without `#` in its path because this workspace's `####` directory previously broke Webpack tracing. Do not disable tracing to work around path issues. Turbopack's CSS worker needs to open a local port; restricted sandboxes may require additional execution permission.

See [the security audit](docs/security-audit-2026-09-10.md) for findings, validation and rollout limits, and [data handling](docs/data-minimization.md).
