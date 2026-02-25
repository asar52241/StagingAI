# AI Declutter MVP

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
- Frontend image resize normalization (max side `3000px`)
- Backend validations:
  - `image` required in all modes
  - `mask` required only for `mode=mask`
  - mime types (`image` JPG/PNG, `mask` PNG for `mode=mask`)
  - limits (`image <= 50MB`, `mask <= 4MB` for `mode=mask`)
  - mask transparency + dimension checks for `mode=mask`
  - invalid `mode` returns `400 INVALID_MODE`
- In-memory IP rate limit: `10 requests / minute`
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

2. Create `.env.local`:

```bash
OPENAI_API_KEY=your_openai_api_key_here
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
npm run build
```

## API contract

### `POST /api/declutter`

`multipart/form-data`:

- `image` (required): JPG/PNG
- `mode` (optional): `mask|auto` (default: `mask`)
- `mask` (required only for `mode=mask`): PNG with transparency
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

- Recommended: Vercel (Next.js default)
- Set `OPENAI_API_KEY` in project environment variables
- Keep API key server-only (never expose in client code)
