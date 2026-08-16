# StagingAI

Mask-based inpainting tool for real-estate photos.

## What is implemented

- Next.js App Router + TypeScript app
- `POST /api/declutter` backend that supports two modes:
  - `mode=mask` (manual mask edit)
  - `mode=auto` (auto-declutter without user mask)
- Browser editor with:
  - Manual mask flow (erase/paint, brush size, undo, reset)
  - Auto-declutter CTA (`Удалить всё (авто)`)
  - Manual fallback after auto (`Доработать вручную`)
- Mask export as PNG (alpha) and submit with image
- Frontend image resize/compression normalization (max side `3000px`, upload payload `<= 3.5MB` to fit Vercel's 4.5MB Function limit)
- Backend validations:
  - `image` required in all modes
  - `mask` required only for `mode=mask`
  - mime types (`image` JPG/PNG, `mask` PNG for `mode=mask`)
  - Vercel-safe limits (`image <= 3.5MB`, `mask <= 512KB` for `mode=mask`)
  - mask transparency + dimension checks for `mode=mask`
  - invalid `mode` returns `400 INVALID_MODE`
- Server-side paid quota (Upstash Redis): `/api/declutter` atomically reserves a photo before the provider call and commits it only after an image is returned. Invalid uploads and provider-rejected requests do not consume quota; expired in-flight reservations are released automatically. `/api/payment/result` and `/api/payment/status` idempotently create the order record — a single `sa_paid` cookie can no longer be replayed for unlimited generations
- IP-hash rate limit on `/api/payment/create` (Upstash Redis, short TTL) to curb invoice spam
- Structured request logging (request id, duration, status, input metadata)

## Requirements

- Node.js 20+ (22 LTS recommended)
- npm
- OpenAI API key with image edit access

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` (see `.env.example` for the full list — OpenAI, Robokassa, Upstash Redis):

```bash
OPENAI_API_KEY=your_openai_api_key_here
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_token
```

3. Run dev server:

```bash
npm run dev
```

Note: this repository path contains `#` characters (`.../####/...`). `npm run dev` is configured with Turbopack to avoid a Next.js manifest bug on such paths.

4. Open `http://localhost:3000`.

## Build and type-check

```bash
npx tsc --noEmit
npm test
npm run test:integration
npm run build
```

## API contract

### `POST /api/declutter`

`multipart/form-data`:

- `image` (required): JPG/PNG, up to 3.5MB
- `mode` (optional): `mask|auto` (default: `mask`)
- `mask` (required only for `mode=mask`): PNG with transparency, up to 512KB
- `output_format` (optional): `png|jpeg|webp` (default: `png`)
- `quality` (optional): `high|medium` (default: `high`)

Success:

- Binary `image/*` response (`Content-Type` reflects `output_format`)

Error:

```json
{
  "error": {
    "code": "STRING_CODE",
    "message": "Human-readable message",
    "request_id": "uuid"
  }
}
```

Notes:

- In `mode=auto`, backend ignores `mask` if present.
- Auto mode may repaint room details more aggressively than manual masked mode.

## Deploy

- Recommended: Vercel (Next.js default). Vercel Functions cap request and response bodies at 4.5MB; this app normalizes browser uploads to fit. To accept original files or results above that limit, use object storage with short-lived browser upload/download URLs (for example S3 or R2). A private Vercel Blob alone does not remove the response limit because it must be served through a Function.
- Set `OPENAI_API_KEY` in project environment variables
- Keep API key server-only (never expose in client code)
