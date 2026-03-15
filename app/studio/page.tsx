"use client";

import Link from "next/link";
import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { LEGAL } from "@/config/legal";
import { deleteOrder, loadOrder, saveOrder, type StoredPhoto } from "@/lib/photoDB";
import MaskEditor, {
  MaskEditorHandle,
  MaskToolMode,
} from "../../components/MaskEditor/MaskEditor";
import s from "./page.module.css";

// ── Types ──────────────────────────────────────────────────────────────────────
type PhotoStatus = "uploading" | "ready" | "masked" | "error" | "processing" | "done";
type BatchMode = "auto" | "manual";

interface PhotoEntry {
  id: number;
  file: File;
  name: string;
  previewUrl: string;
  status: PhotoStatus;
  error?: string;
  maskFile?: File;
  resultBlob?: Blob;
  resultUrl?: string;
  hasRetry: boolean;
  dimensions?: { width: number; height: number };
}

// ── Constants ──────────────────────────────────────────────────────────────────
const MAX_PHOTOS  = LEGAL.maxPhotosPerOrder;

// ── Image helpers (ported from original) ──────────────────────────────────────
async function normalizeImageFile(
  sourceFile: File,
  maxSidePx: number,
): Promise<{ file: File; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(sourceFile);
    const img = new Image();
    img.onload = () => {
      const ow = img.naturalWidth, oh = img.naturalHeight;
      const scale = Math.min(1, maxSidePx / Math.max(ow, oh));
      const w = Math.max(1, Math.round(ow * scale));
      const h = Math.max(1, Math.round(oh * scale));
      URL.revokeObjectURL(url);
      if (scale === 1) { resolve({ file: sourceFile, width: w, height: h }); return; }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas error")); return; }
      ctx.drawImage(img, 0, 0, w, h);
      const mime = sourceFile.type === "image/png" ? "image/png"
        : sourceFile.type === "image/webp" ? "image/webp"
        : "image/jpeg";
      canvas.toBlob((blob) => {
        if (!blob) { reject(new Error("Blob error")); return; }
        resolve({ file: new File([blob], sourceFile.name, { type: mime }), width: w, height: h });
      }, mime, 0.92);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Load error")); };
    img.src = url;
  });
}

async function normalizeResultToTargetDimensions(
  sourceBlob: Blob, targetWidth: number, targetHeight: number, mimeType: string,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(sourceBlob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.naturalWidth === targetWidth && img.naturalHeight === targetHeight) {
        resolve(sourceBlob); return;
      }
      const ratio  = img.naturalWidth / img.naturalHeight;
      const tRatio = targetWidth / targetHeight;
      let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
      if (ratio > tRatio)  { sw = Math.round(sh * tRatio); sx = Math.round((img.naturalWidth  - sw) / 2); }
      else if (ratio < tRatio) { sh = Math.round(sw / tRatio); sy = Math.round((img.naturalHeight - sh) / 2); }
      const canvas = document.createElement("canvas");
      canvas.width = targetWidth; canvas.height = targetHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas error")); return; }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
      const outMime = mimeType.includes("jpeg") ? "image/jpeg" : mimeType.includes("webp") ? "image/webp" : "image/png";
      canvas.toBlob((blob) => {
        if (!blob) { reject(new Error("Blob error")); return; }
        resolve(blob);
      }, outMime, 0.95);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image error")); };
    img.src = url;
  });
}

async function parseDeclutterError(response: Response): Promise<string> {
  try {
    const d = (await response.json()) as { error?: { message?: string } };
    if (d.error?.message) return d.error.message;
  } catch { /* fallback */ }
  return "Не удалось выполнить обработку.";
}

// ── BeforeAfterSlider ──────────────────────────────────────────────────────────
function BeforeAfterSlider({ before, after }: { before: string; after: string }) {
  const [pos, setPos] = useState(50);
  const dragging = useRef(false);
  const wrapRef  = useRef<HTMLDivElement>(null);

  const move = useCallback((clientX: number) => {
    if (!wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    setPos(Math.max(2, Math.min(98, ((clientX - rect.left) / rect.width) * 100)));
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => { if (dragging.current) move(e.clientX); };
    const onUp   = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [move]);

  return (
    <div ref={wrapRef} className={s.baWrap} onMouseDown={() => { dragging.current = true; }}>
      <img src={after}  alt="после" className={s.baAfter} />
      <div className={s.baBefore} style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <img src={before} alt="до" className={s.baBeforeImg} />
      </div>
      <div className={s.baDivider} style={{ left: `${pos}%` }} />
      <span className={`${s.baLbl} ${s.baLblBefore}`}>ДО</span>
      <span className={`${s.baLbl} ${s.baLblAfter}`}>ПОСЛЕ</span>
    </div>
  );
}

// ── Status maps ────────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<PhotoStatus, string> = {
  uploading: "Загрузка…", ready: "Готово", masked: "Маска ✓",
  error: "Ошибка", processing: "Обработка", done: "Результат",
};
const STATUS_CLASS: Record<PhotoStatus, string> = {
  uploading: s.stUploading, ready: s.stReady, masked: s.stMasked,
  error: s.stError, processing: s.stProcessing, done: s.stDone,
};

// ── Main component ─────────────────────────────────────────────────────────────
let nextId = 0;

export default function StudioPage() {
  // ── Core state ───────────────────────────────────────────────────────────────
  const [photos, setPhotos]             = useState<PhotoEntry[]>([]);
  const [mode, setMode]                 = useState<BatchMode>("auto");
  const [isPaid, setIsPaid]             = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver]     = useState(false);
  const [amountBump, setAmountBump]     = useState(false);

  // ── Manual masking state ──────────────────────────────────────────────────────
  const [maskingIndex, setMaskingIndex]   = useState(0);
  const [maskTool, setMaskTool]           = useState<MaskToolMode>("erase");
  const [maskBrush, setMaskBrush]         = useState(34);
  const [maskCanUndo, setMaskCanUndo]     = useState(false);
  const [maskCanRedo, setMaskCanRedo]     = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentChecked, setConsentChecked]     = useState(false);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [paymentError, setPaymentError]           = useState<string | null>(null);
  const maskEditorRef = useRef<MaskEditorHandle | null>(null);

  // ── URL cleanup ───────────────────────────────────────────────────────────────
  const photosRef = useRef<PhotoEntry[]>([]);
  useEffect(() => { photosRef.current = photos; }, [photos]);
  useEffect(() => {
    return () => {
      photosRef.current.forEach((p) => {
        URL.revokeObjectURL(p.previewUrl);
        if (p.resultUrl) URL.revokeObjectURL(p.resultUrl);
      });
    };
  }, []);

  // ── Возврат с Робокассы ───────────────────────────────────────────────────────
  useEffect(() => {
    const params    = new URLSearchParams(window.location.search);
    const invIdStr  = params.get("InvId");
    // Робокасса может редиректить без paid=, но с InvId+SignatureValue — нормализуем
    const paidParam = params.get("paid")
      ?? (invIdStr && params.get("SignatureValue") ? "true" : null);

    // Fallback: paid=true без InvId — читаем из localStorage
    if (paidParam === "true" && !invIdStr) {
      const pendingRaw = localStorage.getItem("stagingai_pending");
      if (!pendingRaw) return;
      let pending: { invId: number; outSum: string };
      try { pending = JSON.parse(pendingRaw); } catch { localStorage.removeItem("stagingai_pending"); return; }

      (async () => {
        try {
          const statusUrl = `/api/payment/status?invId=${pending.invId}&outSum=${encodeURIComponent(pending.outSum)}&sig=&noSig=true`;
          const statusRes = await fetch(statusUrl);
          const { paid }  = (await statusRes.json()) as { paid: boolean };

          if (!paid) {
            setPaymentError(
              `Оплата ещё не подтверждена. Если деньги были списаны — обратитесь в поддержку: ${LEGAL.email}`,
            );
            return;
          }

          localStorage.removeItem("stagingai_pending");
          const order = await loadOrder(pending.invId);
          if (!order) {
            window.history.replaceState({}, "", "/studio");
            setIsPaid(true);
            setPaymentError(
              "Не удалось восстановить фотографии (данные в браузере удалены). Загрузите фото заново — оплата действительна.",
            );
            return;
          }

          const restoredPhotos: PhotoEntry[] = order.photos.map((p: StoredPhoto) => ({
            ...p,
            previewUrl: URL.createObjectURL(p.file),
            resultUrl:  undefined,
            resultBlob: undefined,
            error:      undefined,
          }));

          setPhotos(restoredPhotos);
          setMode(order.mode as BatchMode);
          setIsPaid(true);
          setIsProcessing(true);
          window.history.replaceState({}, "", "/studio");

          for (const photo of restoredPhotos) {
            await processPhoto(photo, order.mode as BatchMode);
          }

          setIsProcessing(false);
          await deleteOrder(pending.invId);
        } catch {
          localStorage.removeItem("stagingai_pending");
          window.history.replaceState({}, "", "/studio");
          setPaymentError(`Произошла ошибка при восстановлении заказа. Обратитесь в поддержку: ${LEGAL.email}`);
        }
      })();
      return;
    }

    if (!paidParam || !invIdStr) return;
    // InvId остаётся в URL до завершения проверки, чтобы перезагрузка повторяла попытку

    const invId = parseInt(invIdStr, 10);

    if (paidParam === "false") {
      // fix #5: восстанавливаем фото для повторной попытки
      localStorage.removeItem("stagingai_pending");
      window.history.replaceState({}, "", "/studio");
      (async () => {
        const order = await loadOrder(invId).catch(() => null);
        if (order) {
          const restored: PhotoEntry[] = order.photos.map((p: StoredPhoto) => ({
            ...p,
            previewUrl: URL.createObjectURL(p.file),
            resultUrl:  undefined,
            resultBlob: undefined,
            error:      undefined,
          }));
          setPhotos(restored);
          setMode(order.mode as BatchMode);
        }
        setPaymentError("Оплата отменена или не прошла. Попробуйте ещё раз.");
      })();
      return;
    }

    (async () => {
      try {
        // 1. Проверяем статус платежа:
        //    передаём OutSum и SignatureValue из SuccessURL — сервер верифицирует подпись
        //    MD5(OutSum:InvId:Password1). Работает в тест и боевом режиме.
        const outSum = params.get("OutSum") ?? "";
        const sig    = params.get("SignatureValue") ?? "";
        const statusUrl = `/api/payment/status?invId=${invIdStr}&outSum=${encodeURIComponent(outSum)}&sig=${encodeURIComponent(sig)}`;
        const statusRes = await fetch(statusUrl);
        const { paid }  = (await statusRes.json()) as { paid: boolean };

        if (!paid) {
          // Не убираем URL — перезагрузка повторит проверку (fix #4)
          setPaymentError(
            `Оплата ещё не подтверждена. Если деньги были списаны — обратитесь в поддержку: ${LEGAL.email}`,
          );
          return;
        }

        localStorage.removeItem("stagingai_pending");

        // 2. Восстанавливаем фото из IndexedDB
        const order = await loadOrder(invId);
        if (!order) {
          window.history.replaceState({}, "", "/studio");
          setIsPaid(true); // cookie установлен — /api/declutter примет запросы
          setPaymentError(
            "Не удалось восстановить фотографии (данные в браузере удалены). Загрузите фото заново — оплата действительна.",
          );
          return;
        }

        const restoredPhotos: PhotoEntry[] = order.photos.map((p: StoredPhoto) => ({
          ...p,
          previewUrl: URL.createObjectURL(p.file),
          resultUrl:  undefined,
          resultBlob: undefined,
          error:      undefined,
        }));

        setPhotos(restoredPhotos);
        setMode(order.mode as BatchMode);
        setIsPaid(true);
        setIsProcessing(true);
        window.history.replaceState({}, "", "/studio"); // убираем только здесь (fix #4)

        for (const photo of restoredPhotos) {
          await processPhoto(photo, order.mode as BatchMode);
        }

        setIsProcessing(false);
        await deleteOrder(invId);
      } catch {
        localStorage.removeItem("stagingai_pending");
        window.history.replaceState({}, "", "/studio");
        setPaymentError(`Произошла ошибка при восстановлении заказа. Обратитесь в поддержку: ${LEGAL.email}`);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived ───────────────────────────────────────────────────────────────────
  const validPhotos   = photos.filter((p) => p.status !== "error");
  const validCount    = validPhotos.length;
  const maskedCount   = validPhotos.filter((p) => p.status === "masked").length;
  const totalPrice    = Math.max(validCount, LEGAL.minPhotosPerOrder) * LEGAL.pricePerPhoto;
  const allMasked     = mode === "auto" ||
    validPhotos.every((p) => ["masked", "processing", "done"].includes(p.status));

  // Safe clamped index for the mask editor
  const clampedIndex    = Math.min(maskingIndex, Math.max(0, validPhotos.length - 1));
  const currentMaskPhoto = validPhotos[clampedIndex] ?? null;

  // Right panel mode: masking OR results
  const isManualMasking = mode === "manual" && !isPaid && validPhotos.length > 0;

  const resultPhotos = photos.filter((p) =>
    ["processing", "done"].includes(p.status) || (isPaid && p.status === "error"),
  );
  const doneCount = photos.filter((p) => p.status === "done").length;

  // ── CTA ───────────────────────────────────────────────────────────────────────
  type CtaState = "disabled" | "warn" | "ready" | "done";
  let ctaState: CtaState  = "disabled";
  let ctaText             = "Загрузить фото";
  let ctaExtraClass       = "";

  if (isPaid) {
    ctaState = "done";
    ctaText  = isProcessing ? "Обработка…" : "Обработка завершена ✓";
    ctaExtraClass = s.ctaDone;
  } else if (validCount === 0) {
    ctaState = "disabled";
  } else if (validCount < LEGAL.minPhotosPerOrder) {
    ctaState = "warn";
    ctaText  = `Загрузите ещё ${LEGAL.minPhotosPerOrder - validCount} фото (минимум ${LEGAL.minPhotosPerOrder})`;
    ctaExtraClass = s.ctaWarn;
  } else if (mode === "manual" && !allMasked) {
    const remaining = validPhotos.filter((p) => p.status === "ready").length;
    ctaState = "warn";
    ctaText  = `Разметьте ещё ${remaining} фото (кисть →)`;
    ctaExtraClass = s.ctaWarn;
  } else {
    ctaState = "ready";
    ctaText  = `Оплатить ${totalPrice} ₽ и запустить`;
    ctaExtraClass = s.ctaReady;
  }

  // ── File handling ─────────────────────────────────────────────────────────────
  const addFiles = useCallback(async (files: File[]) => {
    const currentCount = photosRef.current.length;
    const allowed = Array.from(files).slice(0, MAX_PHOTOS - currentCount);
    if (!allowed.length) return;

    const entries: PhotoEntry[] = allowed.map((f) => {
      const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]);
      const valid = ALLOWED_TYPES.has(f.type) && f.size <= 50 * 1024 * 1024;
      return {
        id: ++nextId,
        file: f, name: f.name,
        previewUrl: URL.createObjectURL(f),
        status: valid ? "uploading" : "error",
        error: valid ? undefined : f.size > 50 * 1024 * 1024 ? "Файл слишком большой (макс 50MB)" : "Unsupported image format. Allowed formats: JPG, PNG, WEBP, GIF.",
        hasRetry: true,
      };
    });

    setPhotos((prev) => [...prev, ...entries]);
    setAmountBump(true);
    setTimeout(() => setAmountBump(false), 200);

    for (const entry of entries) {
      if (entry.status !== "uploading") continue;
      try {
        const { file: normalized, width, height } = await normalizeImageFile(entry.file, 3000);
        setPhotos((prev) =>
          prev.map((p) =>
            p.id === entry.id ? { ...p, file: normalized, dimensions: { width, height }, status: "ready" } : p,
          ),
        );
      } catch (err) {
        setPhotos((prev) =>
          prev.map((p) =>
            p.id === entry.id
              ? { ...p, status: "error", error: err instanceof Error ? err.message : "Ошибка загрузки" }
              : p,
          ),
        );
      }
    }
  }, []);

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length) addFiles(files);
  };

  const removePhoto = (id: number) => {
    setPhotos((prev) => {
      const photo = prev.find((p) => p.id === id);
      if (photo) { URL.revokeObjectURL(photo.previewUrl); if (photo.resultUrl) URL.revokeObjectURL(photo.resultUrl); }
      return prev.filter((p) => p.id !== id);
    });
    setAmountBump(true);
    setTimeout(() => setAmountBump(false), 200);
    // Clamp index after removal
    setMaskingIndex((prev) => Math.max(0, Math.min(prev, validPhotos.length - 2)));
  };

  // ── Mode switching ────────────────────────────────────────────────────────────
  const handleSetMode = (m: BatchMode) => {
    setMode(m);
    if (m === "manual") {
      // Jump to first unmasked photo
      const valid = photosRef.current.filter((p) => p.status !== "error");
      const firstUnmasked = valid.findIndex((p) => p.status === "ready");
      setMaskingIndex(firstUnmasked >= 0 ? firstUnmasked : 0);
      setMaskCanUndo(false);
      setMaskCanRedo(false);
    } else {
      // Clear masks when switching back to auto
      setPhotos((prev) =>
        prev.map((p) => (p.status === "masked" ? { ...p, status: "ready", maskFile: undefined } : p)),
      );
    }
  };

  // ── Thumbnail click (manual mode navigation) ──────────────────────────────────
  const handleThumbClick = (photo: PhotoEntry) => {
    if (mode === "manual" && !isPaid) {
      const idx = validPhotos.findIndex((p) => p.id === photo.id);
      if (idx >= 0) { setMaskingIndex(idx); setMaskCanUndo(false); setMaskCanRedo(false); }
    }
  };

  // ── Mask navigation ───────────────────────────────────────────────────────────
  const handleMaskNext = async () => {
    if (!currentMaskPhoto) return;
    const exported = await maskEditorRef.current?.exportMaskPng();
    if (!exported) return;

    setPhotos((prev) =>
      prev.map((p) =>
        p.id === currentMaskPhoto.id ? { ...p, maskFile: exported.file, status: "masked" } : p,
      ),
    );

    if (clampedIndex < validPhotos.length - 1) {
      setMaskingIndex(clampedIndex + 1);
      setMaskCanUndo(false);
      setMaskCanRedo(false);
    }
    // If last photo, stay — the "all done" state will render
  };

  const handleMaskPrev = async () => {
    if (currentMaskPhoto) {
      const exported = await maskEditorRef.current?.exportMaskPng();
      if (exported) {
        setPhotos((prev) =>
          prev.map((p) =>
            p.id === currentMaskPhoto.id ? { ...p, maskFile: exported.file } : p,
          ),
        );
      }
    }
    setMaskingIndex(Math.max(0, clampedIndex - 1));
    setMaskCanUndo(false);
    setMaskCanRedo(false);
  };

  const handleMaskSkip = () => {
    if (clampedIndex < validPhotos.length - 1) {
      setMaskingIndex(clampedIndex + 1);
      setMaskCanUndo(false);
      setMaskCanRedo(false);
    }
  };

  // Whether all photos have been visited and are masked (show "all done" in editor area)
  const allDone = isManualMasking && maskedCount === validPhotos.length && validPhotos.length > 0;
  // Show "all done" state when on last photo and all are masked
  const showAllDone = allDone;

  // ── Processing ────────────────────────────────────────────────────────────────
  const processPhoto = async (photo: PhotoEntry, batchMode: BatchMode) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === photo.id ? { ...p, status: "processing", error: undefined } : p)),
    );
    try {
      const formData = new FormData();
      formData.append("image", photo.file);
      formData.append("mode",  batchMode === "manual" ? "mask" : "auto");
      formData.append("output_format", "png");
      formData.append("quality", "high");
      if (batchMode === "manual" && photo.maskFile) formData.append("mask", photo.maskFile);

      const abortCtrl = new AbortController();
      const abortTimer = setTimeout(() => abortCtrl.abort(), 5 * 60 * 1000);
      let response: Response;
      try {
        response = await fetch("/api/declutter", { method: "POST", body: formData, signal: abortCtrl.signal });
      } catch (fetchErr) {
        if (fetchErr instanceof Error && fetchErr.name === "AbortError") {
          throw new Error("Превышен лимит ожидания (5 мин). Попробуйте ещё раз.");
        }
        throw fetchErr;
      } finally {
        clearTimeout(abortTimer);
      }
      if (!response.ok) throw new Error(await parseDeclutterError(response));

      const mime       = response.headers.get("Content-Type") ?? "image/png";
      const blob       = await response.blob();
      const normalized = photo.dimensions
        ? await normalizeResultToTargetDimensions(blob, photo.dimensions.width, photo.dimensions.height, mime)
        : blob;
      const resultUrl  = URL.createObjectURL(normalized);

      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photo.id ? { ...p, status: "done", resultBlob: normalized, resultUrl } : p,
        ),
      );
    } catch (err) {
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photo.id
            ? { ...p, status: "error", error: err instanceof Error ? err.message : "Ошибка обработки" }
            : p,
        ),
      );
    }
  };

  const handlePay = () => {
    if (ctaState !== "ready") return;
    // Show consent modal before processing
    setConsentChecked(false);
    setShowConsentModal(true);
  };

  const handleConfirmConsent = async () => {
    if (!consentChecked || isCreatingPayment) return;
    const toProcess = photos.filter((p) => p.status === "ready" || p.status === "masked");
    if (!toProcess.length) return;

    setIsCreatingPayment(true);
    try {
      // 1. Создаём платёж на сервере
      const res = await fetch("/api/payment/create", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ photoCount: Math.max(validCount, LEGAL.minPhotosPerOrder) }),
      });
      if (!res.ok) throw new Error("payment create failed");
      const { paymentUrl, invId } = (await res.json()) as { paymentUrl: string; invId: number };

      // 2. Сохраняем фото в IndexedDB (переживут редирект)
      await saveOrder({
        invId,
        mode,
        photos: toProcess.map((p) => ({
          id:         p.id,
          file:       p.file,
          name:       p.name,
          status:     p.status as "ready" | "masked",
          maskFile:   p.maskFile,
          dimensions: p.dimensions,
          hasRetry:   p.hasRetry,
        })),
      });

      // 3. Сохраняем pending-платёж в localStorage (fallback если Робокасса вернёт без параметров)
      localStorage.setItem(
        "stagingai_pending",
        JSON.stringify({
          invId,
          outSum: (Math.max(validCount, LEGAL.minPhotosPerOrder) * LEGAL.pricePerPhoto).toFixed(2),
        }),
      );

      // 4. Редиректим на Робокассу
      window.location.href = paymentUrl;
    } catch {
      setIsCreatingPayment(false);
      setShowConsentModal(false);
      setPaymentError("Не удалось создать платёж. Проверьте соединение и попробуйте ещё раз.");
    }
  };

  const handleRetry = async (photo: PhotoEntry) => {
    if (!photo.hasRetry) return;
    setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, hasRetry: false } : p)));
    await processPhoto(photo, mode);
  };

  const handleDownload = (photo: PhotoEntry) => {
    if (!photo.resultUrl) return;
    const a = document.createElement("a");
    a.href     = photo.resultUrl;
    a.download = `staging_${photo.name.replace(/\.[^.]+$/, "")}.png`;
    a.click();
  };

  // ── Right panel subtitle ──────────────────────────────────────────────────────
  const rpSub = !isPaid
    ? "Ожидание загрузки и оплаты"
    : isProcessing
    ? "Обработка фотографий…"
    : `Готово · ${doneCount} фото обработано`;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className={s.root}>
      {/* ── Header ── */}
      <header className={s.hdr}>
        <span className={s.logo}>StagingAI</span>
        <span className={s.hdrBadge}>Edition Mode</span>
        <span className={s.hdrInfo}>JPG / PNG / WEBP / GIF · до 50 МБ · до 30 фото</span>
        <Link href="/" className={s.hdrBack}>← На лендинг</Link>
      </header>

      <div className={s.app}>

        {/* ════ LEFT PANEL ════ */}
        <div className={s.lp}>
          <div className={s.lpScroll}>

            <div className={s.secLbl}>Загрузка фото</div>

            {/* Drop zone */}
            <div
              className={`${s.dropzone} ${isDragOver ? s.dropzoneOver : ""}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragOver(false); addFiles(Array.from(e.dataTransfer.files)); }}
            >
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className={s.fileInput} onChange={handleFileInput} />
              <div className={s.dzIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className={s.dzTitle}>Перетащите фото сюда</div>
              <div className={s.dzSub}>или нажмите для выбора</div>
              <div className={s.dzTags}>
                <span className={s.dzTag}>JPG / PNG / WEBP / GIF</span>
                <span className={s.dzTag}>до 50 МБ</span>
                <span className={s.dzTag}>до 30 фото</span>
              </div>
            </div>

            {photos.length > 0 && (
              <>
                {/* Counter */}
                <div className={s.phCounter}>
                  <span>Загружено: <strong>{photos.length}</strong></span>
                  <span className={s.phLimit}>{photos.length} / {MAX_PHOTOS}</span>
                </div>

                {/* Grid */}
                <div className={s.phGrid}>
                  {photos.map((p) => {
                    const isCurrentInEditor = mode === "manual" && !isPaid &&
                      validPhotos[clampedIndex]?.id === p.id;
                    const isClickable = mode === "manual" && !isPaid && p.status !== "error";
                    return (
                      <div
                        key={p.id}
                        className={`${s.phThumb} ${isCurrentInEditor ? s.phThumbActive : ""} ${isClickable ? s.phThumbClickable : ""}`}
                        onClick={isClickable ? () => handleThumbClick(p) : undefined}
                      >
                        <img src={p.previewUrl} alt={p.name} className={s.thumbImg} />
                        {p.status === "uploading" && <div className={s.shimmer} />}
                        <div className={s.thumbOverlay} />
                        {/* Remove button only when not in manual-editing */}
                        {!isCurrentInEditor && (
                          <button
                            className={s.rmBtn}
                            onClick={(e) => { e.stopPropagation(); removePhoto(p.id); }}
                          >×</button>
                        )}
                        <span className={`${s.stBadge} ${STATUS_CLASS[p.status]}`}>
                          {STATUS_LABELS[p.status]}
                        </span>
                      </div>
                    );
                  })}

                  {photos.length < MAX_PHOTOS && (
                    <label className={s.addMoreCell}>
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={handleFileInput} />
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                      </svg>
                      <span>Добавить</span>
                    </label>
                  )}
                </div>

                {/* Mode selector */}
                <div className={s.secLbl} style={{ marginTop: 4 }}>Режим обработки</div>
                <div className={s.modeGrid}>
                  <div
                    className={`${s.modeCard} ${s.modeAuto} ${mode === "auto" ? s.modeSelected : ""}`}
                    onClick={() => handleSetMode("auto")}
                  >
                    <div className={s.mcCheck}>
                      {mode === "auto" && (
                        <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <div className={`${s.mcIcon} ${s.mcIconAuto}`}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div className={s.mcTitle}>Удалить всё автоматически</div>
                    <div className={s.mcDesc}>ИИ убирает все движимые объекты</div>
                  </div>

                  <div
                    className={`${s.modeCard} ${s.modeManual} ${mode === "manual" ? s.modeSelected : ""}`}
                    onClick={() => handleSetMode("manual")}
                  >
                    <div className={s.mcCheck}>
                      {mode === "manual" && (
                        <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <div className={`${s.mcIcon} ${s.mcIconManual}`}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div className={s.mcTitle}>Удалить вручную (кисть)</div>
                    <div className={s.mcDesc}>Разметьте зоны на каждом фото</div>
                  </div>
                </div>

                {mode === "manual" && !isPaid && (
                  <div className={s.manualHint}>
                    Справа откроется редактор — обведите кистью объекты для удаления на каждом фото, затем нажмите «Следующее».
                  </div>
                )}

                {/* Pricing */}
                <div className={s.secLbl} style={{ marginTop: 4 }}>Стоимость</div>
                <div className={s.priceCard}>
                  <div className={s.pcHdr}>
                    <span className={s.pcLabel}>Расчёт заказа</span>
                    <span className={s.pcRate}>50 ₽ / фото</span>
                  </div>
                  <div className={s.pcRows}>
                    <div className={s.pcRow}>
                      <span className={s.pcRowLbl}>Действительных фото</span>
                      <span className={s.pcRowVal}>{validCount}</span>
                    </div>
                    <div className={s.pcRow}>
                      <span className={s.pcRowLbl}>К расчёту</span>
                      <span className={s.pcRowVal}>
                        {validCount < LEGAL.minPhotosPerOrder ? `${LEGAL.minPhotosPerOrder} (минимум)` : Math.max(validCount, LEGAL.minPhotosPerOrder)}
                      </span>
                    </div>
                  </div>
                  <div className={s.pcDivider} />
                  <div className={s.pcTotal}>
                    <span className={s.pcTotalLbl}>К оплате</span>
                    <span className={`${s.pcAmount} ${amountBump ? s.pcAmountBump : ""}`}>
                      {totalPrice} ₽
                    </span>
                  </div>
                  {validCount > 0 && validCount < LEGAL.minPhotosPerOrder && (
                    <div className={s.pcWarn}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
                        <circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>
                        Минимальный пакет {LEGAL.minPhotosPerOrder} фото: {LEGAL.minPhotosPerOrder * LEGAL.pricePerPhoto} ₽.
                        Добавьте ещё {LEGAL.minPhotosPerOrder - validCount} фото.
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* CTA */}
          <div className={s.ctaWrap}>
            <button
              className={`${s.cta} ${ctaExtraClass}`}
              disabled={ctaState === "disabled" || ctaState === "done" || isProcessing}
              onClick={ctaState === "ready" ? handlePay : undefined}
            >
              {ctaText}
            </button>
          </div>
        </div>

        {/* ════ RIGHT PANEL ════ */}
        <div className={s.rp}>

          {isManualMasking ? (
            /* ── Manual masking workspace ── */
            <div className={s.maskWorkspace}>

              {/* Header with progress */}
              <div className={s.maskHdr}>
                <div className={s.maskHdrLeft}>
                  <div className={s.maskHdrTitle}>Разметка масок</div>
                  <div className={s.maskHdrSub}>
                    Фото {clampedIndex + 1} из {validPhotos.length}
                    {maskedCount > 0 && ` · Размечено: ${maskedCount} / ${validPhotos.length}`}
                  </div>
                </div>

                {/* Photo dots (up to 20; beyond that show text only) */}
                {validPhotos.length <= 20 && (
                  <div className={s.maskDots}>
                    {validPhotos.map((p, i) => (
                      <button
                        key={p.id}
                        className={`${s.maskDot} ${p.status === "masked" ? s.maskDotDone : ""} ${i === clampedIndex ? s.maskDotCurrent : ""}`}
                        onClick={() => { setMaskingIndex(i); setMaskCanUndo(false); setMaskCanRedo(false); }}
                        title={p.name}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Tool controls */}
              <div className={s.maskToolbar}>
                {/* Brush (paint / restore) */}
                <button
                  className={`${s.toolIconBtn} ${maskTool === "paint" ? s.toolBtnActive : ""}`}
                  onClick={() => setMaskTool("paint")}
                  title="Brush — restore mask"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9"/>
                    <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
                  </svg>
                </button>

                {/* Eraser (erase / mark for removal) */}
                <button
                  className={`${s.toolIconBtn} ${maskTool === "erase" ? s.toolBtnActive : ""}`}
                  onClick={() => setMaskTool("erase")}
                  title="Eraser — mark area for removal"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 20H7L3 16l13-13 7 7-3 3"/>
                    <path d="M6 17l4-4"/>
                  </svg>
                </button>

                <span className={s.toolSep} />

                {/* Undo */}
                <button
                  className={s.toolIconBtn}
                  disabled={!maskCanUndo}
                  onClick={() => maskEditorRef.current?.undo()}
                  title="Undo"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7v6h6"/>
                    <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/>
                  </svg>
                </button>

                {/* Redo */}
                <button
                  className={s.toolIconBtn}
                  disabled={!maskCanRedo}
                  onClick={() => maskEditorRef.current?.redo()}
                  title="Redo"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 7v6h-6"/>
                    <path d="M3 17a9 9 0 019-9 9 9 0 016 2.3L21 13"/>
                  </svg>
                </button>

                {/* Reset */}
                <button
                  className={`${s.toolIconBtn} ${s.toolIconBtnDanger}`}
                  onClick={() => setShowResetModal(true)}
                  title="Reset mask"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14H6L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                    <path d="M9 6V4h6v2"/>
                  </svg>
                </button>

                <label className={s.brushLabel}>
                  {maskBrush}px
                  <input type="range" min={8} max={120} value={maskBrush} onChange={(e) => setMaskBrush(Number(e.target.value))} />
                </label>
              </div>

              {/* Editor area */}
              <div className={s.maskEditorArea}>
                {showAllDone ? (
                  <div className={s.maskAllDone}>
                    <div className={s.maskAllDoneIco}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0ED9A3" strokeWidth="2">
                        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div className={s.maskAllDoneTitle}>Все фото размечены!</div>
                    <div className={s.maskAllDoneDesc}>
                      {maskedCount} {maskedCount === 1 ? "фото размечено" : "фото размечено"}. Нажмите «Оплатить» на панели слева, чтобы запустить обработку.
                    </div>
                  </div>
                ) : currentMaskPhoto ? (
                  <MaskEditor
                    key={currentMaskPhoto.id}
                    ref={maskEditorRef}
                    imageFile={currentMaskPhoto.file}
                    initialMaskFile={currentMaskPhoto.maskFile}
                    mode={maskTool}
                    brushSize={maskBrush}
                    maskPreset="opaque-white"
                    onHistoryStateChange={({ canUndo: u, canRedo: r }) => { setMaskCanUndo(u); setMaskCanRedo(r); }}
                  />
                ) : null}
              </div>

              {/* Reset confirmation modal */}
              {showResetModal && (
                <div className={s.modalOverlay} onClick={() => setShowResetModal(false)}>
                  <div className={s.modal} onClick={(e) => e.stopPropagation()}>
                    <div className={s.modalTitle}>Сбросить маску?</div>
                    <div className={s.modalDesc}>Все нарисованные области будут удалены. Это действие нельзя отменить.</div>
                    <div className={s.modalActions}>
                      <button className={s.modalBtnCancel} onClick={() => setShowResetModal(false)}>Отмена</button>
                      <button className={s.modalBtnConfirm} onClick={() => {
                        maskEditorRef.current?.reset();
                        setMaskCanUndo(false);
                        setMaskCanRedo(false);
                        setShowResetModal(false);
                      }}>Сбросить</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation footer */}
              {!showAllDone && (
                <div className={s.maskNavFooter}>
                  <button
                    className={s.maskNavBtn}
                    disabled={clampedIndex === 0}
                    onClick={handleMaskPrev}
                  >← Назад</button>
                  <button
                    className={s.maskNavBtn}
                    onClick={handleMaskSkip}
                    disabled={clampedIndex >= validPhotos.length - 1}
                  >Пропустить</button>
                  <button
                    className={s.maskNavBtnPrimary}
                    onClick={handleMaskNext}
                  >
                    {clampedIndex >= validPhotos.length - 1 ? "Готово ✓" : "Следующее →"}
                  </button>
                </div>
              )}
            </div>

          ) : (
            /* ── Normal right panel (empty or results) ── */
            <>
              <div className={s.rpHdr}>
                <div>
                  <div className={s.rpTitle}>Результаты обработки</div>
                  <div className={s.rpSub}>{rpSub}</div>
                </div>
              </div>
              <div className={s.rpScroll}>
                {!isPaid ? (
                  <div className={s.empty}>
                    <div className={s.emptyIco}>
                      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#3D4460" strokeWidth="1.5">
                        <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div className={s.emptyTitle}>Результаты появятся здесь</div>
                    <div className={s.emptyDesc}>После оплаты запустится обработка. Обычно 10–40 секунд на фото.</div>
                  </div>
                ) : (
                  <div className={s.resGrid}>
                    {resultPhotos.map((photo, i) => (
                      <div key={photo.id} className={s.resCard} style={{ animationDelay: `${i * 0.1}s` }}>
                        <div className={s.resPhoto}>
                          {photo.status === "processing" ? (
                            <>
                              <img src={photo.previewUrl} alt="" className={s.resBgImg} />
                              <div className={s.procOverlay}>
                                <div className={s.spinner} />
                                <div className={s.procTxt}>Обрабатывается…</div>
                                <div className={s.progBar}><div className={s.progFill} /></div>
                              </div>
                            </>
                          ) : photo.status === "done" && photo.resultUrl ? (
                            <BeforeAfterSlider before={photo.previewUrl} after={photo.resultUrl} />
                          ) : (
                            <>
                              <img src={photo.previewUrl} alt="" className={s.resBgImg} />
                              {photo.error && (
                                <div className={s.errorOverlay}>
                                  <span className={s.errorTxt}>{photo.error}</span>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                        <div className={s.resName}>{photo.name}</div>
                        <div className={s.resActions}>
                          <button
                            className={`${s.actBtn} ${s.actBtnPrimary}`}
                            disabled={photo.status !== "done"}
                            onClick={() => handleDownload(photo)}
                          >↓ Скачать</button>
                          <button
                            className={s.actBtn}
                            disabled={photo.status !== "done" || !photo.hasRetry}
                            onClick={() => handleRetry(photo)}
                          >↺ Переделать</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

        </div>
      </div>

      {/* ── Ошибка оплаты ── */}
      {paymentError && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 w-full max-w-md px-4">
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 shadow-lg flex items-start gap-3">
            <svg className="mt-0.5 shrink-0 text-red-500" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
            </svg>
            <p className="text-sm text-red-700 flex-1">{paymentError}</p>
            <button onClick={() => setPaymentError(null)} className="shrink-0 text-red-400 hover:text-red-600">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Consent modal ── */}
      {showConsentModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowConsentModal(false); }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-gray-900">Перед оформлением заказа</h2>
            <p className="mt-2 text-sm text-gray-500">
              Нажимая «Подтвердить», вы подтверждаете, что ознакомились с условиями
              и даёте своё согласие.
            </p>

            <label className="mt-5 flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">
                Я принимаю условия{" "}
                <Link
                  href="/offer"
                  target="_blank"
                  className="text-blue-600 underline"
                >
                  Публичной оферты
                </Link>{" "}
                и даю согласие на обработку персональных данных в соответствии
                с{" "}
                <Link
                  href="/privacy"
                  target="_blank"
                  className="text-blue-600 underline"
                >
                  Политикой конфиденциальности
                </Link>
                .
              </span>
            </label>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowConsentModal(false)}
                className="flex-1 rounded-full border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                onClick={handleConfirmConsent}
                disabled={!consentChecked || isCreatingPayment}
                className="flex-1 rounded-full bg-gray-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
              >
                {isCreatingPayment ? "Создаём платёж…" : "Подтвердить и оплатить"}
              </button>
            </div>

            <p className="mt-4 text-center text-xs text-gray-400">
              {LEGAL.sellerType} {LEGAL.sellerName} · ИНН {LEGAL.sellerInn}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
