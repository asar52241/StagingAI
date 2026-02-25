import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type OutputFormat = "png" | "jpeg" | "webp";
type OutputQuality = "high" | "medium";
type ImageDimensions = { width: number; height: number };
type PngMetadata = ImageDimensions & { hasTransparency: boolean };
type ModelSize = "1024x1024" | "1536x1024" | "1024x1536";
type DeclutterMode = "mask" | "auto";

const BASE_PROMPT =
  "Mask-based edit task for a real-estate photo. Edit ONLY inside the transparent mask area (alpha=0). Do NOT modify any non-masked pixels. Remove only the masked object(s) and reconstruct realistic background surfaces in that region (wall, floor, ceiling) with consistent geometry, perspective, texture, shadows, and lighting. Preserve all unmasked content exactly as in the source photo, including rugs/carpets, wall decor, curtains, windows, lamps, and floor color, unless explicitly masked. Keep camera framing and overall color balance unchanged. Photorealistic listing-quality result. No new objects, no text, no logos, no watermark.";
const AUTO_DECLUTTER_PROMPT =
  "Remove all movable objects from the room: all furniture, appliances, personal items, decorations, clutter, cables, trash, boxes, posters, rugs, plants, and any freestanding items. Keep only the structural elements of the space: walls, floor, ceiling, windows, doors, built-in fixtures, and architectural features. Preserve the original room geometry, perspective, and camera angle. Match the existing lighting and shadows naturally. The result must look like a realistic real-estate listing photo of an empty room. Do not add new objects, furniture, text, logos, or watermarks. Photorealistic.";
const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const MAX_MASK_BYTES = 4 * 1024 * 1024;
const SUPPORTED_IMAGE_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]);
const RATE_LIMIT_MAX_REQUESTS = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateLimitStore = new Map<string, number[]>();

function parsePngMetadata(bytes: Buffer): PngMetadata | null {
  const pngSignature = [
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ];
  if (bytes.length < 8) {
    return null;
  }

  for (let i = 0; i < pngSignature.length; i += 1) {
    if (bytes[i] !== pngSignature[i]) {
      return null;
    }
  }

  let width = 0;
  let height = 0;
  let hasTRNS = false;
  let colorType = -1;
  let offset = 8;

  while (offset + 12 <= bytes.length) {
    const chunkLength = bytes.readUInt32BE(offset);
    const chunkType = bytes.toString("ascii", offset + 4, offset + 8);
    const chunkDataStart = offset + 8;
    const chunkDataEnd = chunkDataStart + chunkLength;
    const nextChunkOffset = chunkDataEnd + 4;

    if (nextChunkOffset > bytes.length) {
      return null;
    }

    if (chunkType === "IHDR") {
      if (chunkLength < 13) {
        return null;
      }
      width = bytes.readUInt32BE(chunkDataStart);
      height = bytes.readUInt32BE(chunkDataStart + 4);
      colorType = bytes[chunkDataStart + 9];
    } else if (chunkType === "tRNS") {
      hasTRNS = true;
    } else if (chunkType === "IEND") {
      break;
    }

    offset = nextChunkOffset;
  }

  if (!width || !height) {
    return null;
  }

  const hasAlphaChannel = colorType === 4 || colorType === 6;
  return {
    width,
    height,
    hasTransparency: hasAlphaChannel || hasTRNS,
  };
}

function parseJpegDimensions(bytes: Buffer): ImageDimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null;
  }

  const sofMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce,
    0xcf,
  ]);

  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];
    offset += 2;

    if (marker === 0xd8 || marker === 0xd9) {
      continue;
    }

    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }

    if (offset + 2 > bytes.length) {
      return null;
    }

    const segmentLength = bytes.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) {
      return null;
    }

    if (sofMarkers.has(marker)) {
      if (segmentLength < 7) {
        return null;
      }

      const height = bytes.readUInt16BE(offset + 3);
      const width = bytes.readUInt16BE(offset + 5);
      if (!width || !height) {
        return null;
      }
      return { width, height };
    }

    offset += segmentLength;
  }

  return null;
}

function parseImageDimensions(bytes: Buffer, mimeType: string): ImageDimensions | null {
  if (mimeType === "image/png") {
    const png = parsePngMetadata(bytes);
    if (!png) {
      return null;
    }
    return { width: png.width, height: png.height };
  }

  if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
    return parseJpegDimensions(bytes);
  }

  return null;
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  requestId: string,
  extraHeaders?: Record<string, string>,
) {
  return Response.json(
    {
      error: {
        code,
        message,
        request_id: requestId,
      },
    },
    {
      status,
      headers: {
        "X-Request-Id": requestId,
        ...extraHeaders,
      },
    },
  );
}

function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  return "unknown";
}

function checkRateLimit(ip: string, nowMs: number): { allowed: boolean; retryAfterSeconds: number } {
  const previous = rateLimitStore.get(ip) ?? [];
  const recent = previous.filter((timestamp) => nowMs - timestamp < RATE_LIMIT_WINDOW_MS);

  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    rateLimitStore.set(ip, recent);
    const oldest = recent[0];
    const retryAfterMs = RATE_LIMIT_WINDOW_MS - (nowMs - oldest);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  recent.push(nowMs);
  rateLimitStore.set(ip, recent);
  return { allowed: true, retryAfterSeconds: 0 };
}

function logStructured(
  level: "info" | "warn" | "error",
  payload: Record<string, unknown>,
) {
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.info(line);
}

function parseOutputFormat(value: FormDataEntryValue | null): OutputFormat {
  if (value === "jpeg" || value === "webp" || value === "png") {
    return value;
  }
  return "png";
}

function parseOutputQuality(value: FormDataEntryValue | null): OutputQuality {
  if (value === "medium" || value === "high") {
    return value;
  }
  return "high";
}

function parseMode(value: FormDataEntryValue | null): DeclutterMode | "invalid" {
  if (value === null) {
    return "mask";
  }

  if (typeof value !== "string") {
    return "invalid";
  }

  if (value === "mask" || value === "auto") {
    return value;
  }

  return "invalid";
}

function getContentType(outputFormat: OutputFormat): string {
  if (outputFormat === "jpeg") {
    return "image/jpeg";
  }
  if (outputFormat === "webp") {
    return "image/webp";
  }
  return "image/png";
}

function pickModelSize(dimensions: ImageDimensions): ModelSize {
  const ratio = dimensions.width / dimensions.height;
  if (ratio > 1.15) {
    return "1536x1024";
  }
  if (ratio < 0.87) {
    return "1024x1536";
  }
  return "1024x1024";
}

async function decodeResultImage(
  item: { b64_json?: string | null; url?: string | null },
  requestId: string,
): Promise<Buffer> {
  if (item.b64_json) {
    return Buffer.from(item.b64_json, "base64");
  }

  if (item.url) {
    const upstream = await fetch(item.url, { cache: "no-store" });
    if (!upstream.ok) {
      throw new Error(`UPSTREAM_IMAGE_FETCH_FAILED:${requestId}`);
    }
    return Buffer.from(await upstream.arrayBuffer());
  }

  throw new Error(`OPENAI_IMAGE_PAYLOAD_MISSING:${requestId}`);
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const startedAtMs = Date.now();
  const ip = getClientIp(request);
  let modeForLog: DeclutterMode | "invalid" | "unknown" = "unknown";
  let maskRequiredForLog = false;
  let maskPresentForLog = false;
  let maskIgnoredForLog = false;

  const fail = (
    status: number,
    code: string,
    message: string,
    level: "warn" | "error" = "warn",
    extraHeaders?: Record<string, string>,
    details?: Record<string, unknown>,
  ) => {
    logStructured(level, {
      request_id: requestId,
      ip,
      duration_ms: Date.now() - startedAtMs,
      status,
      code,
      error_message: message,
      mode: modeForLog,
      mask_required: maskRequiredForLog,
      mask_present: maskPresentForLog,
      mask_ignored: maskIgnoredForLog,
      ...details,
    });

    return errorResponse(status, code, message, requestId, extraHeaders);
  };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return fail(
      500,
      "OPENAI_API_KEY_MISSING",
      "Server is not configured: OPENAI_API_KEY is missing.",
      "error",
    );
  }

  const rateLimit = checkRateLimit(ip, Date.now());
  if (!rateLimit.allowed) {
    return fail(
      429,
      "RATE_LIMIT_EXCEEDED",
      "Too many requests. Please try again in a minute.",
      "warn",
      { "Retry-After": String(rateLimit.retryAfterSeconds) },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return fail(
      400,
      "INVALID_MULTIPART",
      "Request must be multipart/form-data with image.",
      "warn",
    );
  }

  const image = formData.get("image");
  const maskEntry = formData.get("mask");
  const mask = maskEntry instanceof File ? maskEntry : null;
  const mode = parseMode(formData.get("mode"));
  modeForLog = mode;
  maskRequiredForLog = mode === "mask";
  maskPresentForLog = mask instanceof File;
  maskIgnoredForLog = mode === "auto" && maskPresentForLog;

  if (mode === "invalid") {
    return fail(
      400,
      "INVALID_MODE",
      "Field 'mode' must be either 'mask' or 'auto'.",
      "warn",
    );
  }

  if (!(image instanceof File)) {
    return fail(
      400,
      "IMAGE_REQUIRED",
      "Field 'image' is required.",
      "warn",
    );
  }

  if (mode === "mask" && !(mask instanceof File)) {
    return fail(
      400,
      "MASK_REQUIRED",
      "Field 'mask' is required.",
      "warn",
    );
  }

  const imageMimeType = image.type.toLowerCase();
  const maskMimeType = mask?.type.toLowerCase() ?? "";

  if (!SUPPORTED_IMAGE_MIME.has(imageMimeType)) {
    return fail(
      400,
      "INVALID_IMAGE_TYPE",
      "Unsupported image format. Allowed formats: JPG, PNG, WEBP, GIF.",
      "warn",
      undefined,
      { image_mime: imageMimeType },
    );
  }

  if (mode === "mask" && maskMimeType !== "image/png") {
    return fail(
      400,
      "INVALID_MASK_TYPE",
      "Mask must be PNG with transparency.",
      "warn",
      undefined,
      { mask_mime: maskMimeType },
    );
  }

  if (image.size > MAX_IMAGE_BYTES) {
    return fail(
      400,
      "IMAGE_TOO_LARGE",
      "Source image is too large (max 50MB).",
      "warn",
      undefined,
      { image_bytes: image.size },
    );
  }

  if (mode === "mask" && mask && mask.size > MAX_MASK_BYTES) {
    return fail(
      400,
      "MASK_TOO_LARGE",
      "Mask is too large (max 4MB).",
      "warn",
      undefined,
      { mask_bytes: mask.size },
    );
  }

  let imageBytes: Buffer;
  let maskBytes: Buffer | null = null;
  try {
    if (mode === "mask" && mask) {
      [imageBytes, maskBytes] = await Promise.all([
        Buffer.from(await image.arrayBuffer()),
        Buffer.from(await mask.arrayBuffer()),
      ]);
    } else {
      imageBytes = Buffer.from(await image.arrayBuffer());
    }
  } catch {
    return fail(
      400,
      "FILE_READ_FAILED",
      "Failed to read uploaded files.",
      "warn",
    );
  }

  const imageDimensions = parseImageDimensions(imageBytes, imageMimeType);
  if (!imageDimensions) {
    return fail(
      400,
      "INVALID_IMAGE_FILE",
      "Source image file is invalid or unsupported.",
      "warn",
      undefined,
      { image_mime: imageMimeType, image_bytes: image.size },
    );
  }

  let maskMetadata: PngMetadata | null = null;
  if (mode === "mask" && mask && maskBytes) {
    maskMetadata = parsePngMetadata(maskBytes);
    if (!maskMetadata) {
      return fail(
        400,
        "INVALID_MASK_FILE",
        "Mask must be a valid PNG file.",
        "warn",
        undefined,
        { mask_bytes: mask.size },
      );
    }

    if (!maskMetadata.hasTransparency) {
      return fail(
        400,
        "MASK_TRANSPARENCY_REQUIRED",
        "Mask must be PNG with transparency.",
        "warn",
      );
    }

    if (
      imageDimensions.width !== maskMetadata.width ||
      imageDimensions.height !== maskMetadata.height
    ) {
      return fail(
        400,
        "DIMENSION_MISMATCH",
        "Mask must match source image dimensions.",
        "warn",
        undefined,
        {
          image_width: imageDimensions.width,
          image_height: imageDimensions.height,
          mask_width: maskMetadata.width,
          mask_height: maskMetadata.height,
        },
      );
    }
  }

  const outputFormat = parseOutputFormat(formData.get("output_format"));
  const quality = parseOutputQuality(formData.get("quality"));
  const modelSize = pickModelSize(imageDimensions);
  const client = new OpenAI({ apiKey });

  try {
    const prompt = mode === "auto" ? AUTO_DECLUTTER_PROMPT : BASE_PROMPT;

    // The current SDK typing omits `output_format` for edits, but the API supports it.
    const editPayload: Record<string, unknown> = {
      model: "gpt-image-1.5",
      prompt,
      image: [image],
      n: 1,
      output_format: outputFormat,
      quality,
      size: modelSize,
    };
    if (mode === "mask" && mask) {
      editPayload.mask = mask;
    }

    const result = await client.images.edit(editPayload as any);

    const item = result.data?.[0];
    if (!item) {
      return fail(
        502,
        "OPENAI_EMPTY_RESPONSE",
        "OpenAI returned an empty image response.",
        "error",
      );
    }

    const bytes = await decodeResultImage(item, requestId);
    const body = new Blob([Uint8Array.from(bytes)], {
      type: getContentType(outputFormat),
    });

    logStructured("info", {
      request_id: requestId,
      ip,
      duration_ms: Date.now() - startedAtMs,
      status: 200,
      code: "OK",
      mode,
      mask_required: mode === "mask",
      mask_present: Boolean(mask),
      mask_ignored: mode === "auto" && Boolean(mask),
      image_bytes: image.size,
      mask_bytes: mask?.size ?? 0,
      image_width: imageDimensions.width,
      image_height: imageDimensions.height,
      mask_width: maskMetadata?.width ?? null,
      mask_height: maskMetadata?.height ?? null,
      output_format: outputFormat,
      quality,
      model_size: modelSize,
    });

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": getContentType(outputFormat),
        "Cache-Control": "no-store",
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      const providerMessage = error.message || "OpenAI request failed.";
      return fail(
        502,
        "OPENAI_API_ERROR",
        providerMessage,
        "error",
        undefined,
        {
          mode,
          mask_required: mode === "mask",
          mask_present: Boolean(mask),
          mask_ignored: mode === "auto" && Boolean(mask),
          image_bytes: image.size,
          mask_bytes: mask?.size ?? 0,
          provider_status: error.status,
        },
      );
    }

    return fail(
      500,
      "INTERNAL_ERROR",
      "Unexpected server error.",
      "error",
    );
  }
}
