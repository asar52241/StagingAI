"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

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
};

type MaskEditorProps = {
  imageFile: File;
  initialMaskFile?: File;
  mode: MaskToolMode;
  brushSize: number;
  maskPreset?: MaskPreset;
  maskPresetVersion?: number;
  onHistoryStateChange?: (state: { canUndo: boolean; canRedo: boolean }) => void;
};

type Point = {
  x: number;
  y: number;
};

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
  },
  ref,
) {
  const MAX_HISTORY_SNAPSHOTS = 21; // Initial state + 20 actions (>= 10 undo steps).
  const imageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [isDrawing, setIsDrawing] = useState(false);
  const previousPointRef = useRef<Point | null>(null);
  const historyRef = useRef<ImageData[]>([]);
  const redoStackRef = useRef<ImageData[]>([]);

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
      return;
    }

    // Keep fully transparent mask for auto-declutter manual fallback.
    ctx.globalCompositeOperation = "source-over";
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
        setHistory([...historyRef.current, stateToRestore], false);
        return true;
      },
      reset() {
        applyMaskPresetToCanvas("opaque-white");
        const snapshot = captureSnapshot();
        if (!snapshot) {
          return;
        }
        setHistory([snapshot]);
      },
    }),
    [onHistoryStateChange],
  );

  useEffect(() => {
    const imageCanvas = imageCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!imageCanvas || !maskCanvas) {
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
  }, [imageFile, maskPreset]);

  useEffect(() => {
    if (!dimensions) {
      return;
    }

    applyMaskPresetToCanvas(maskPreset);
    const snapshot = captureSnapshot();
    if (!snapshot) {
      return;
    }
    setHistory([snapshot]);
  }, [maskPreset, maskPresetVersion, dimensions]);

  function getCanvasPoint(event: React.PointerEvent<HTMLCanvasElement>): Point | null {
    const canvas = maskCanvasRef.current;
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
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const point = getCanvasPoint(event);
    if (!point) {
      return;
    }

    setIsDrawing(true);
    previousPointRef.current = point;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawStroke(point, point);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
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

  return (
    <section className="panel">
      <h2>Mask editor (Task 3)</h2>
      <p className="muted">
        Draw on the top layer: erase mode makes mask transparent; paint mode restores
        opaque white.
      </p>

      {dimensions ? (
        <p className="muted">
          Canvas: {dimensions.width} x {dimensions.height}px
        </p>
      ) : null}

      <div className="maskCanvasStack">
        <canvas
          ref={imageCanvasRef}
          className="imageCanvas"
          aria-label="Image layer"
        />
        <canvas
          ref={maskCanvasRef}
          className="maskCanvas"
          aria-label="Mask layer"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
          onPointerCancel={stopDrawing}
        />
      </div>
    </section>
  );
});

MaskEditor.displayName = "MaskEditor";

export default MaskEditor;
