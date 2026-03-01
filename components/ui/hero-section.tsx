"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeftRightIcon, ArrowRightIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Glow } from "@/components/ui/glow";
import { Mockup, MockupFrame } from "@/components/ui/mockup";
import { cn } from "@/lib/utils";

interface HeroAction {
  text: string;
  href: string;
  icon?: ReactNode;
  variant?: "default" | "glow";
}

interface HeroProps {
  id?: string;
  badge?: {
    text: string;
    action: {
      text: string;
      href: string;
    };
  };
  title: ReactNode;
  description: string;
  note?: string;
  actions: HeroAction[];
  comparison: {
    beforeSrc: string;
    afterSrc: string;
    beforeAlt: string;
    afterAlt: string;
    helperText?: string;
    beforeLabel?: string;
    afterLabel?: string;
  };
  className?: string;
}

interface CompareSliderProps {
  beforeSrc: string;
  afterSrc: string;
  beforeAlt: string;
  afterAlt: string;
  helperText?: string;
  beforeLabel?: string;
  afterLabel?: string;
}

function CompareSlider({
  beforeSrc,
  afterSrc,
  beforeAlt,
  afterAlt,
  helperText = "Потяните ползунок для сравнения",
  beforeLabel = "До",
  afterLabel = "После",
}: CompareSliderProps) {
  const [position, setPosition] = useState(52);

  return (
    <div className="relative w-full">
      <div className="relative aspect-[16/10] overflow-hidden bg-black/5">
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
          onChange={(e) => setPosition(Number(e.target.value))}
          className="absolute inset-0 z-20 h-full w-full cursor-ew-resize opacity-0"
        />
      </div>

      <div className="border-t border-gray-100 bg-gray-50/70 px-4 py-2.5 text-center text-xs text-gray-500">
        {helperText}
      </div>
    </div>
  );
}

export function HeroSection({
  id = "hero",
  badge,
  title,
  description,
  note,
  actions,
  comparison,
  className,
}: HeroProps) {
  return (
    <section
      id={id}
      className={cn(
        "relative overflow-hidden bg-background px-4 pb-8 pt-12 text-foreground sm:py-24 md:py-28",
        "fade-bottom",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 left-1/2 h-72 w-[72rem] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,_hsla(var(--brand)/.25)_0%,_hsla(var(--brand-foreground)/0)_65%)] blur-2xl" />
      </div>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-12 pt-8 sm:gap-20 sm:pt-14">
        <div className="flex flex-col items-center gap-6 text-center sm:gap-10">
          {badge && (
            <Badge variant="outline" className="animate-appear gap-2">
              <span className="text-muted-foreground">{badge.text}</span>
              <Link
                href={badge.action.href}
                className="inline-flex items-center gap-1 text-foreground transition hover:text-primary"
              >
                {badge.action.text}
                <ArrowRightIcon className="h-3 w-3" />
              </Link>
            </Badge>
          )}

          <h1
            className="relative z-10 inline-block animate-appear bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-4xl font-extrabold leading-tight text-transparent sm:text-6xl md:text-7xl md:leading-tight"
            style={{ fontFamily: "Inter, system-ui, sans-serif" }}
          >
            {title}
          </h1>

          <p className="text-md relative z-10 max-w-[720px] animate-appear font-medium text-muted-foreground opacity-0 delay-100 sm:text-xl">
            {description}
          </p>

          <div className="relative z-10 flex animate-appear flex-wrap justify-center gap-4 opacity-0 delay-300">
            {actions.map((action) => {
              const external = /^https?:\/\//.test(action.href);
              const content = (
                <>
                  {action.icon}
                  {action.text}
                </>
              );

              return (
                <Button
                  key={`${action.href}-${action.text}`}
                  variant={action.variant ?? "default"}
                  size="lg"
                  asChild
                >
                  {external ? (
                    <a
                      href={action.href}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2"
                    >
                      {content}
                    </a>
                  ) : (
                    <Link href={action.href} className="flex items-center gap-2">
                      {content}
                    </Link>
                  )}
                </Button>
              );
            })}
          </div>

          {note && (
            <p className="relative z-10 max-w-2xl text-xs text-muted-foreground/90 sm:text-sm">
              {note}
            </p>
          )}

          <div className="relative w-full max-w-5xl pt-8 sm:pt-12">
            <MockupFrame
              className="animate-appear overflow-hidden border border-border/40 bg-white opacity-0 delay-700"
              size="large"
            >
              <Mockup type="responsive" className="w-full rounded-xl border-border/30">
                <CompareSlider {...comparison} />
              </Mockup>
            </MockupFrame>

            <Glow
              variant="top"
              className="animate-appear-zoom pointer-events-none -z-10 opacity-0 delay-1000"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
