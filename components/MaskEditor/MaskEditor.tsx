"use client";

import { type CSSProperties, forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import s from "./MaskEditor.module.css";

export type MaskToolMode = "erase" | "paint";
export type MaskPreset = "opaque-white" | "fully-transparent";
export type ExportedMask = {
  file: File;
  width: number;
  height: number;
};
export type MaskEditorHandle = {
  exportMaskPng: () => Promise<ExportedMask | null>;
  undo: () => boolean;
  redo: () => boolean;
  reset: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
};

type MaskEditorProps = {
  imageFile: File;
  initialMaskFile?: File;
  mode: MaskToolMode;
  brushSize: number;
  maskPreset?: MaskPreset;
  maskPresetVersion?: number;
  onHistoryStateChange?: (state: { canUndo: boolean; canRedo: boolean }) => void;
  onZoomChange?: (zoom: number) => void;
};

type Point = {
  x: number;
  y: number;
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(value.toFixed(2))));
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to export mask PNG."));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

const MaskEditor = forwardRef<MaskEditorHandle, MaskEditorProps>(function MaskEditor(
  {
    imageFile,
    initialMaskFile,
    mode,
    brushSize,
    maskPreset = "opaque-white",
    maskPresetVersion = 0,
    onHistoryStateChange,
    onZoomChange,
  },
  ref,
) {
  const MAX_HISTORY_SNAPSHOTS = 21; // Initial state + 20 actions (>= 10 undo steps).
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const imageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cursorPreviewRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const [isDrawing, setIsDrawing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const previousPointRef = useRef<Point | null>(null);
  const historyRef = useRef<ImageData[]>([]);
  const redoStackRef = useRef<ImageData[]>([]);

  const fitScale = dimensions && viewportSize.width > 0 && viewportSize.height > 0
    ? Math.min(
        Math.max(viewportSize.width - 32, 1) / dimensions.width,
        Math.max(viewportSize.height - 32, 1) / dimensions.height,
      )
    : 1;
  const displayWidth = dimensions ? dimensions.width * fitScale * zoom : 0;
  const displayHeight = dimensions ? dimensions.height * fitScale * zoom : 0;

  function setZoomLevel(nextZoom: number) {
    const viewport = viewportRef.current;
    const clampedZoom = clampZoom(nextZoom);

    if (!viewport || clampedZoom === zoom) {
      setZoom(clampedZoom);
      return;
    }

    const centerX = viewport.scrollLeft + viewport.clientWidth / 2;
    const centerY = viewport.scrollTop + viewport.clientHeight / 2;
    const ratioX = viewport.scrollWidth > 0 ? centerX / viewport.scrollWidth : 0.5;
    const ratioY = viewport.scrollHeight > 0 ? centerY / viewport.scrollHeight : 0.5;

    setZoom(clampedZoom);

    requestAnimationFrame(() => {
      const nextCenterX = viewport.scrollWidth * ratioX;
      const nextCenterY = viewport.scrollHeight * ratioY;
      viewport.scrollLeft = Math.max(0, nextCenterX - viewport.clientWidth / 2);
      viewport.scrollTop = Math.max(0, nextCenterY - viewport.clientHeight / 2);
    });
  }

  function syncPreviewFromMask() {
    const maskCanvas = maskCanvasRef.current;
    const previewCanvas = previewCanvasRef.current;
    if (!maskCanvas || !previewCanvas) {
      return;
    }

    const previewCtx = previewCanvas.getContext("2d");
    if (!previewCtx) {
      return;
    }

    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

    previewCtx.globalCompositeOperation = "source-over";
    previewCtx.fillStyle = "rgba(255, 122, 92, 0.28)";
    previewCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
    previewCtx.globalCompositeOperation = "destination-out";
    previewCtx.drawImage(maskCanvas, 0, 0);
    previewCtx.globalCompositeOperation = "source-over";
  }

  function setHistory(nextHistory: ImageData[], clearRedo = true) {
    const trimmed = nextHistory.slice(-MAX_HISTORY_SNAPSHOTS);
    historyRef.current = trimmed;
    if (clearRedo) redoStackRef.current = [];
    onHistoryStateChange?.({ canUndo: trimmed.length > 1, canRedo: redoStackRef.current.length > 0 });
  }

  function captureSnapshot(): ImageData | null {
    const canvas = maskCanvasRef.current;
    if (!canvas) {
      return null;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }

    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  function applyMaskPresetToCanvas(preset: MaskPreset) {
    const canvas = maskCanvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (preset === "opaque-white") {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      syncPreviewFromMask();
      return;
    }

    // Keep fully transparent mask for auto-declutter manual fallback.
    ctx.globalCompositeOperation = "source-over";
    syncPreviewFromMask();
  }

  function commitHistorySnapshot() {
    const snapshot = captureSnapshot();
    if (!snapshot) {
      return;
    }
    setHistory([...historyRef.current, snapshot]);
  }

  useImperativeHandle(
    ref,
    () => ({
      async exportMaskPng() {
        const canvas = maskCanvasRef.current;
        if (!canvas || !canvas.width || !canvas.height) {
          return null;
        }

        const blob = await canvasToPngBlob(canvas);
        return {
          file: new File([blob], "mask.png", { type: "image/png" }),
          width: canvas.width,
          height: canvas.height,
        };
      },
      undo() {
        if (historyRef.current.length <= 1) {
          return false;
        }

        const canvas = maskCanvasRef.current;
        if (!canvas) {
          return false;
        }

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return false;
        }

        const currentSnapshot = historyRef.current[historyRef.current.length - 1];
        redoStackRef.current = [...redoStackRef.current, currentSnapshot];

        const nextHistory = historyRef.current.slice(0, -1);
        const previousSnapshot = nextHistory[nextHistory.length - 1];
        ctx.putImageData(previousSnapshot, 0, 0);
        syncPreviewFromMask();
        setHistory(nextHistory, false);
        return true;
      },
      redo() {
        if (redoStackRef.current.length === 0) {
          return false;
        }

        const canvas = maskCanvasRef.current;
        if (!canvas) {
          return false;
        }

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return false;
        }

        const stateToRestore = redoStackRef.current[redoStackRef.current.length - 1];
        redoStackRef.current = redoStackRef.current.slice(0, -1);
        ctx.putImageData(stateToRestore, 0, 0);
        syncPreviewFromMask();
        setHistory([...historyRef.current, stateToRestore], false);
        return true;
      },
      reset() {
        applyMaskPresetToCanvas(maskPreset);
        const snapshot = captureSnapshot();
        if (!snapshot) {
          return;
        }
        setHistory([snapshot]);
      },
      zoomIn() {
        setZoomLevel(zoom + ZOOM_STEP);
      },
      zoomOut() {
        setZoomLevel(zoom - ZOOM_STEP);
      },
      resetZoom() {
        setZoomLevel(1);
      },
    }),
    [maskPreset, onHistoryStateChange, zoom],
  );

  useEffect(() => {
    onZoomChange?.(zoom);
  }, [onZoomChange, zoom]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const updateViewportSize = () => {
      setViewportSize({
        width: viewport.clientWidth,
        height: viewport.clientHeight,
      });
    };

    updateViewportSize();

    const observer = new ResizeObserver(updateViewportSize);
    observer.observe(viewport);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const imageCanvas = imageCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const previewCanvas = previewCanvasRef.current;
    if (!imageCanvas || !maskCanvas || !previewCanvas) {
      return;
    }

    const objectUrl = URL.createObjectURL(imageFile);
    const image = new Image();

    image.onload = () => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      setDimensions({ width, height });

      imageCanvas.width = width;
      imageCanvas.height = height;
      maskCanvas.width = width;
      maskCanvas.height = height;
      previewCanvas.width = width;
      previewCanvas.height = height;

      const imageCtx = imageCanvas.getContext("2d");
      const maskCtx = maskCanvas.getContext("2d");
      if (!imageCtx || !maskCtx) {
        return;
      }

      imageCtx.clearRect(0, 0, width, height);
      imageCtx.drawImage(image, 0, 0, width, height);

      if (initialMaskFile) {
        // Restore previously saved mask instead of applying blank preset.
        const maskUrl = URL.createObjectURL(initialMaskFile);
        const maskImage = new Image();
        maskImage.onload = () => {
          maskCtx.clearRect(0, 0, width, height);
          maskCtx.globalCompositeOperation = "source-over";
          maskCtx.drawImage(maskImage, 0, 0, width, height);
          syncPreviewFromMask();
          URL.revokeObjectURL(maskUrl);
          const initialSnapshot = maskCtx.getImageData(0, 0, width, height);
          setHistory([initialSnapshot]);
        };
        maskImage.src = maskUrl;
      } else {
        // Mask baseline depends on active preset.
        applyMaskPresetToCanvas(maskPreset);
        const initialSnapshot = maskCtx.getImageData(0, 0, width, height);
        setHistory([initialSnapshot]);
      }
    };

    image.src = objectUrl;

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [imageFile, initialMaskFile, maskPreset]);

  useEffect(() => {
    setZoom(1);
  }, [imageFile]);

  useEffect(() => {
    if (!dimensions || initialMaskFile) {
      return;
    }

    applyMaskPresetToCanvas(maskPreset);
    const snapshot = captureSnapshot();
    if (!snapshot) {
      return;
    }
    setHistory([snapshot]);
  }, [maskPreset, maskPresetVersion, dimensions, initialMaskFile]);

  function getCanvasPoint(event: React.PointerEvent<HTMLCanvasElement>): Point | null {
    const canvas = previewCanvasRef.current;
    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return null;
    }

    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function drawStroke(from: Point, to: Point) {
    const canvas = maskCanvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = brushSize;

    if (mode === "erase") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0, 0, 0, 1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "#ffffff";
    }

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    syncPreviewFromMask();
  }

  function updateCursorPreview(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = previewCanvasRef.current;
    const cursorPreview = cursorPreviewRef.current;
    if (!canvas || !cursorPreview) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) {
      return;
    }

    const relativeX = event.clientX - rect.left;
    const relativeY = event.clientY - rect.top;
    const visibleBrushSize = Math.max(18, (brushSize / canvas.width) * rect.width);

    cursorPreview.style.opacity = "1";
    cursorPreview.style.width = `${visibleBrushSize}px`;
    cursorPreview.style.height = `${visibleBrushSize}px`;
    cursorPreview.style.transform =
      `translate(${relativeX}px, ${relativeY}px) translate(-50%, -50%)`;
  }

  function hideCursorPreview() {
    if (!cursorPreviewRef.current) {
      return;
    }

    cursorPreviewRef.current.style.opacity = "0";
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const point = getCanvasPoint(event);
    if (!point) {
      return;
    }

    updateCursorPreview(event);
    setIsDrawing(true);
    previousPointRef.current = point;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawStroke(point, point);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    updateCursorPreview(event);

    if (!isDrawing) {
      return;
    }

    const point = getCanvasPoint(event);
    const previousPoint = previousPointRef.current;
    if (!point || !previousPoint) {
      return;
    }

    drawStroke(previousPoint, point);
    previousPointRef.current = point;
  }

  function stopDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing) {
      return;
    }

    setIsDrawing(false);
    previousPointRef.current = null;
    commitHistorySnapshot();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleViewportWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (!(event.ctrlKey || event.metaKey)) {
      return;
    }

    event.preventDefault();
    setZoomLevel(zoom + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
  }

  return (
    <div className={s.editorRoot}>
      <div
        ref={viewportRef}
        className={s.editorViewport}
        onWheel={handleViewportWheel}
      >
        <div
          className={s.editorCanvas}
          style={
            displayWidth && displayHeight && viewportSize.width > 0 && viewportSize.height > 0
              ? ({
                  width: `${Math.max(displayWidth, viewportSize.width)}px`,
                  height: `${Math.max(displayHeight, viewportSize.height)}px`,
                } as CSSProperties)
              : undefined
          }
        >
          <div
            className={s.maskCanvasStack}
            style={
              dimensions
                ? ({
                    width: displayWidth ? `${displayWidth}px` : "100%",
                    height: displayHeight ? `${displayHeight}px` : undefined,
                    aspectRatio: `${dimensions.width} / ${dimensions.height}`,
                  } as CSSProperties)
                : undefined
            }
          >
            <canvas
              ref={imageCanvasRef}
              className={s.imageCanvas}
              aria-label="Image layer"
            />
            <canvas
              ref={previewCanvasRef}
              className={s.maskCanvas}
              aria-label="Mask preview layer"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={stopDrawing}
              onPointerLeave={(event) => {
                stopDrawing(event);
                hideCursorPreview();
              }}
              onPointerCancel={(event) => {
                stopDrawing(event);
                hideCursorPreview();
              }}
              onPointerEnter={updateCursorPreview}
            />
            <canvas
              ref={maskCanvasRef}
              className={s.hiddenMaskCanvas}
              aria-hidden="true"
            />
            <div
              ref={cursorPreviewRef}
              className={`${s.cursorPreview} ${mode === "erase" ? s.cursorPreviewErase : s.cursorPreviewPaint}`}
              aria-hidden="true"
            />
            {dimensions ? (
              <div className={s.dimensionsBadge}>
                {dimensions.width} × {dimensions.height}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
});

MaskEditor.displayName = "MaskEditor";

export default MaskEditor;
