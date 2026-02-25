## 1) High-level architecture (MVP)

**One web app** (Next.js) that contains:

* **Client UI**: upload photo, paint mask, submit
* **Server API**: receives `image + mask`, calls OpenAI, returns output image

### Data flow (MVP synchronous)

```
Browser (Editor UI)
  ├─ holds image + mask in memory
  ├─ POST /api/declutter (multipart: image, mask, params)
  ↓
Next.js Server Route (/api/declutter)
  ├─ validates + rate limits
  ├─ calls OpenAI Images Edit
  └─ returns image blob (png/jpeg/webp)
  ↓
Browser shows result + download
```

**No database, no storage** required for MVP.

---

## 2) File + folder structure (Next.js App Router, TypeScript)

```text
ai-declutter/
├─ app/
│  ├─ layout.tsx
│  ├─ page.tsx
│  ├─ editor/
│  │  ├─ page.tsx
│  │  └─ EditorClient.tsx
│  ├─ api/
│  │  └─ declutter/
│  │     └─ route.ts
│  └─ assets/ (optional: small icons)
│
├─ components/
│  ├─ UploadDropzone.tsx
│  ├─ MaskEditor/
│  │  ├─ MaskEditor.tsx
│  │  ├─ useMaskHistory.ts
│  │  ├─ canvasUtils.ts
│  │  └─ types.ts
│  ├─ BeforeAfter.tsx
│  ├─ Toolbar.tsx
│  └─ Spinner.tsx
│
├─ lib/
│  ├─ openaiImages.ts
│  ├─ validation.ts
│  ├─ rateLimit.ts
│  ├─ imageResize.ts
│  └─ errors.ts
│
├─ styles/
│  └─ globals.css
│
├─ public/
│  └─ (static files)
│
├─ .env.local
├─ next.config.js
├─ package.json
├─ tsconfig.json
└─ README.md
```

---

## 3) What each part does

### `app/`

* `page.tsx`
  Landing: “Upload photo → Go to editor”.
* `editor/page.tsx`
  Loads the editor shell (server component) + renders `EditorClient.tsx`.
* `editor/EditorClient.tsx` (**client component**)
  Orchestrates editor state: holds image blob, mask, tool settings, calls API, renders results.
* `api/declutter/route.ts` (**server route**)
  Receives multipart form data. Validates, rate-limits, calls OpenAI, returns image.

### `components/`

* `UploadDropzone.tsx`
  Drag/drop + basic client-side file checks.
* `MaskEditor/MaskEditor.tsx` (**the core**)
  Two-canvas editor: shows image + lets user paint the mask.
* `MaskEditor/useMaskHistory.ts`
  Undo stack for mask edits (store ImageData snapshots or incremental diffs).
* `MaskEditor/canvasUtils.ts`
  Convert canvas → PNG mask blob, resize image, map pointer coords, etc.
* `Toolbar.tsx`
  Brush size, erase/paint toggle, undo/reset, “Generate” button.
* `BeforeAfter.tsx`
  Simple comparison (two panels or slider).
* `Spinner.tsx`
  Loading UI.

### `lib/`

* `openaiImages.ts`
  A single function: `editImageWithMask({ image, mask, prompt, outputFormat })`.
* `validation.ts`
  File checks: types, max sizes, required fields.
* `rateLimit.ts`
  Simple IP-based limit (in-memory for MVP, Redis later).
* `imageResize.ts`
  Optional: normalize very large images (max side 1600–2000px) before sending.
* `errors.ts`
  Error mapping from OpenAI/API into human-friendly messages.

---

## 4) Where state lives (and what state exists)

### Client-side state (browser)

This is where **almost all state lives** in MVP.

**Editor state**

* `originalImageBlob` (uploaded photo)
* `displayImageBitmap` / scaled dimensions
* `maskCanvas` pixels (the “truth” for mask)
* `tool`: `{ mode: 'erase' | 'paint', brushSize: number }`
* `history`: stack for undo (mask snapshots)
* `result`: `{ blob, url, meta }`
* `ui`: `{ isGenerating, error }`

**Why client-side:** mask painting is interactive and must be instant.

### Server-side state (MVP)

Mostly **stateless**:

* Reads request files
* Calls OpenAI
* Returns response
* Uses env var: `OPENAI_API_KEY`

No persistence unless you add it.

---

## 5) How services connect

### MVP service graph

* **Browser** → `POST /api/declutter` (multipart form: `image`, `mask`)
* **Next.js server route** → **OpenAI Images Edit**
* **Server route** → returns processed image to browser

### Contracts (exactly what crosses boundaries)

#### Frontend → Backend (`/api/declutter`)

**Request (multipart/form-data)**

* `image`: File (jpg/png)
* `mask`: File (png with alpha)
* `output_format`: `png|jpeg|webp` (optional)
* `quality`: `high|medium` (optional)
* `prompt_preset`: e.g. `declutter_v1` (optional)

**Response**

* Option A (simplest): returns `image/*` binary (blob)
* Option B: returns JSON `{ resultUrl }` (if you store the output)

#### Backend → OpenAI Images Edit

* Sends `image[]`, `mask`, `prompt`, `model`, `quality`, `output_format`, etc.
* Receives base64 or binary result (depending on API / SDK)
* Converts to output blob for the client

---

## 6) How the MaskEditor should work (critical)

### Two-canvas approach (recommended)

* `imageCanvas`: draws the photo (read-only)
* `maskCanvas`: starts **fully white & opaque**

  * user “removes furniture” by making areas **transparent** (alpha 0)
  * user can “restore” by painting white opaque again

**Modes**

* **Erase** (remove furniture area) → `globalCompositeOperation = 'destination-out'`
* **Paint** (protect area back) → `globalCompositeOperation = 'source-over'` with white

**Export**

* `maskCanvas.toBlob('image/png')` gives `mask.png` with alpha transparency.

**Important normalization**

* Resize the uploaded image to a max side (e.g. 1600–2000px) *inside the editor* and generate the mask at the same size.
* That guarantees image/mask dimensions match, and keeps API fast/cheap.

---

## 7) “Scale-up” architecture (jobs + storage + DB) for real usage

Once brokers start sending many images, you’ll want:

* Avoid long HTTP requests
* Keep results accessible later
* Limit abuse and track usage

### Data flow (async jobs)

```
Browser
  ├─ POST /api/jobs (image+mask)
  └─ polls GET /api/jobs/:id or uses SSE/WebSocket
      ↓
API server
  ├─ stores inputs in Object Storage (R2/S3)
  ├─ writes Job row in DB
  ├─ enqueues job (Redis queue)
      ↓
Worker (separate process)
  ├─ fetches inputs
  ├─ calls OpenAI
  ├─ writes output to storage
  └─ updates Job status in DB
      ↓
Browser downloads result from signed URL
```

### Add these folders (when you scale)

```text
├─ app/api/jobs/route.ts         # create job
├─ app/api/jobs/[id]/route.ts    # job status + result URL
├─ worker/
│  ├─ index.ts                   # queue worker entry
│  └─ processJob.ts              # OpenAI call + storage IO
├─ lib/storage.ts                # R2/S3 put/get + signed URLs
├─ lib/db.ts                     # Prisma client
├─ prisma/schema.prisma          # Job, User, Usage, etc.
```

### Where state lives (scaled)

* **DB**: users, jobs, usage counters, status, timestamps
* **Object storage**: original images, masks, outputs
* **Queue (Redis)**: job execution + retries

---

## 8) Practical recommendation for you (given your requirements)

Since you want:

* MVP fast
* 1 image → 1 result
* user paints mask
* “good enough for listing”
* external API ok

Do this in two phases:

### Phase 1 (MVP, 1–3 days)

* Next.js frontend + `/api/declutter` synchronous route
* Return the output directly as a blob
* No DB, no storage

### Phase 2 (when it works)

* Add object storage (R2/S3) + job table
* Add queue + worker
* Add auth + billing + usage limits
