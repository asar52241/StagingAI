"use client";

import { useState } from "react";
import { ArrowLeftRightIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type CompareSliderVariant = "landing" | "studio";

interface CompareSliderProps {
  beforeSrc: string;
  afterSrc: string;
  beforeAlt: string;
  afterAlt: string;
  helperText?: string | null;
  beforeLabel?: string;
  afterLabel?: string;
  initialPosition?: number;
  variant?: CompareSliderVariant;
  className?: string;
}

export function CompareSlider({
  beforeSrc,
  afterSrc,
  beforeAlt,
  afterAlt,
  helperText = "Потяните ползунок для сравнения",
  beforeLabel = "До",
  afterLabel = "После",
  initialPosition = 52,
  variant = "landing",
  className,
}: CompareSliderProps) {
  const [position, setPosition] = useState(initialPosition);
  const isStudio = variant === "studio";

  return (
    <div className={cn("relative w-full", isStudio && "h-full", className)}>
      <div
        className={cn(
          "relative overflow-hidden bg-black/5",
          isStudio ? "h-full" : "aspect-[16/10]",
        )}
      >
        <img
          src={beforeSrc}
          alt={beforeAlt}
          className="h-full w-full object-cover"
          loading="eager"
        />
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        >
          <img
            src={afterSrc}
            alt={afterAlt}
            className="h-full w-full object-cover"
            loading="eager"
          />
        </div>

        <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/65 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
          {beforeLabel}
        </div>
        <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-gray-900 backdrop-blur-sm">
          {afterLabel}
        </div>

        <div
          className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-white/90 shadow-[0_0_8px_rgba(0,0,0,0.32)]"
          style={{ left: `${position}%` }}
        />
        <div
          className="pointer-events-none absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${position}%` }}
        >
          <div className="grid h-10 w-10 place-items-center rounded-full border-2 border-white bg-gray-900 text-white shadow-lg">
            <ArrowLeftRightIcon className="h-4 w-4" />
          </div>
        </div>

        <input
          type="range"
          min={0}
          max={100}
          value={position}
          aria-label="Сравнение до и после"
          onChange={(event) => setPosition(Number(event.target.value))}
          className="absolute inset-0 z-20 h-full w-full cursor-ew-resize opacity-0"
        />
      </div>

      {helperText ? (
        <div
          className={cn(
            "border-t border-gray-100 bg-gray-50/70 text-center text-gray-500",
            isStudio ? "px-3 py-2 text-[11px]" : "px-4 py-2.5 text-xs",
          )}
        >
          {helperText}
        </div>
      ) : null}
    </div>
  );
}
