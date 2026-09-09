import OpenAI from "openai";
import { createHash } from "node:crypto";
import { verifyOrderToken, type OrderToken } from "@/lib/robokassa";
import { finishProcessing, reserveProcessing } from "@/lib/orders";
import { rateLimit, readCookie, readLimitedBody, RequestError, requireSameOrigin } from "@/lib/requestSecurity";
import { parseImageDimensions, parsePngMetadata, type ImageDimensions, type PngMetadata } from "@/lib/imageValidation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type OutputFormat = "png" | "jpeg" | "webp";
type OutputQuality = "high" | "medium";
type ModelSize = "1024x1024" | "1536x1024" | "1024x1536";
type DeclutterMode = "mask" | "auto";

const BASE_PROMPT =
  "Mask-based edit task for a real-estate photo. Edit ONLY inside the transparent mask area (alpha=0). Do NOT modify any non-masked pixels. Remove only the masked object(s) and reconstruct realistic background surfaces in that region (wall, floor, ceiling) with consistent geometry, perspective, texture, shadows, and lighting. Preserve all unmasked content exactly as in the source photo, including rugs/carpets, wall decor, curtains, windows, lamps, and floor color, unless explicitly masked. Keep camera framing and overall color balance unchanged. Photorealistic listing-quality result. No new objects, no text, no logos, no watermark.";
const AUTO_DECLUTTER_PROMPT =
  "Remove all movable objects from the room: all furniture, appliances, personal items, decorations, clutter, cables, trash, boxes, posters, rugs, plants, and any freestanding items. Keep only the structural elements of the space: walls, floor, ceiling, windows, doors, built-in fixtures, and architectural features. Preserve the original room geometry, perspective, and camera angle. Match the existing lighting and shadows naturally. The result must look like a realistic real-estate listing photo of an empty room. Do not add new objects, furniture, text, logos, or watermarks. Photorealistic.";
// Keep multipart uploads below the Vercel Function request limit.
const MAX_IMAGE_BYTES = Math.floor(3.5 * 1024 * 1024);
const MAX_MASK_BYTES = 512 * 1024;
const SUPPORTED_IMAGE_MIME = new Set(["image/jpeg", "image/jpg", "image/png"]);
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
        "Cache-Control": "no-store",
        ...extraHeaders,
      },
    },
  );
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
  if (item.b64_json && item.b64_json.length <= 80 * 1024 * 1024) {
    return Buffer.from(item.b64_json, "base64");
  }

  throw new Error(`OPENAI_IMAGE_PAYLOAD_MISSING:${requestId}`);
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const startedAtMs = Date.now();
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
      "Image processing service is unavailable.",
      "error",
    );
  }

  let paid: OrderToken | null;
  try {
    requireSameOrigin(request);
    const token = readCookie(request, "sa_paid");
    paid = token ? verifyOrderToken("paid", token) : null;
    if (!paid) return fail(402, "PAYMENT_REQUIRED", "Payment required.");
    if (!await rateLimit(`processing:${paid.invId}`, 10)) {
      return fail(429, "RATE_LIMIT_EXCEEDED", "Too many requests. Please try again in a minute.", "warn", { "Retry-After": "60" });
    }
  } catch (error) {
    return fail(error instanceof RequestError ? error.status : 503, "REQUEST_REJECTED", "Request cannot be processed.");
  }

  let formData: FormData;
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("multipart/form-data;")) throw new RequestError(400, "Invalid multipart");
    const body = await readLimitedBody(request, MAX_IMAGE_BYTES + MAX_MASK_BYTES + 64 * 1024);
    formData = await new Response(Uint8Array.from(body), { headers: { "Content-Type": contentType } }).formData();
  } catch (error) {
    if (error instanceof RequestError && error.status === 413) return fail(413, "BODY_TOO_LARGE", "Request body too large.");
    if (error instanceof RequestError && error.status === 408) return fail(408, "BODY_TIMEOUT", "Image upload timed out.");
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
      "Unsupported image format. Allowed formats: JPG, PNG.",
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
      "Source image is too large (max 3.5MB).",
      "warn",
      undefined,
      { image_bytes: image.size },
    );
  }

  if (mode === "mask" && mask && mask.size > MAX_MASK_BYTES) {
    return fail(
      400,
      "MASK_TOO_LARGE",
      "Mask is too large (max 512KB).",
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
        image.arrayBuffer().then((bytes) => Buffer.from(bytes)),
        mask.arrayBuffer().then((bytes) => Buffer.from(bytes)),
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

  if (imageDimensions.width > 3000 || imageDimensions.height > 3000) {
    return fail(400, "IMAGE_DIMENSIONS_TOO_LARGE", "Resize the image to at most 3000 pixels per side.");
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
  const client = new OpenAI({ apiKey, timeout: 240_000, maxRetries: 0 });
  const fingerprint = createHash("sha256").update(imageBytes).digest("hex");
  try {
    const reservation = await reserveProcessing(paid.invId, paid.owner, fingerprint, requestId);
    if (reservation !== "ok") {
      return fail(reservation === "busy" ? 409 : 402, reservation.toUpperCase(),
        reservation === "busy" ? "This photo is already processing." : "Payment or photo processing allowance exhausted.");
    }
  } catch {
    return fail(503, "ORDER_STORAGE_UNAVAILABLE", "Please try again later.");
  }

  try {
    const prompt = mode === "auto" ? AUTO_DECLUTTER_PROMPT : BASE_PROMPT;

    // The current SDK typing omits `output_format` for edits, but the API supports it.
    const editPayload: OpenAI.ImageEditParams & { output_format: OutputFormat } = {
      model: "gpt-image-1.5",
      prompt,
      image: [new File([Uint8Array.from(imageBytes)], imageMimeType === "image/png" ? "source.png" : "source.jpg", { type: imageMimeType })],
      n: 1,
      output_format: outputFormat,
      quality,
      size: modelSize,
    };
    if (mode === "mask" && mask) {
      editPayload.mask = new File([Uint8Array.from(maskBytes!)], "mask.png", { type: "image/png" });
    }

    const result = await client.images.edit(editPayload);

    const item = result.data?.[0];
    if (!item) {
      return fail(
        502,
        "PROVIDER_EMPTY_RESPONSE",
        "Image processing service returned an empty response.",
        "error",
      );
    }

    const bytes = await decodeResultImage(item, requestId);
    const body = new Blob([Uint8Array.from(bytes)], {
      type: getContentType(outputFormat),
    });

    const usage = result.usage;
    const inputTokens  = usage?.input_tokens  ?? 0;
    const outputTokens = usage?.output_tokens ?? 0;

    logStructured("info", {
      request_id: requestId,
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
      tokens_input:  inputTokens,
      tokens_output: outputTokens,
      tokens_total:  usage?.total_tokens ?? (inputTokens + outputTokens),
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
      return fail(
        502,
        "PROVIDER_API_ERROR",
        "Image processing service failed. Please try again.",
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
  } finally {
    try { await finishProcessing(paid.invId, fingerprint, requestId); }
    catch { logStructured("error", { request_id: requestId, code: "ORDER_FINALIZE_FAILED" }); }
  }
}
