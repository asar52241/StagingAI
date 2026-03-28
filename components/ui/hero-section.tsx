"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CompareSlider } from "@/components/ui/compare-slider";
import { Glow } from "@/components/ui/glow";
import { Mockup, MockupFrame } from "@/components/ui/mockup";
import { cn } from "@/lib/utils";

interface HeroAction {
  text: string;
  href: string;
  icon?: ReactNode;
  onClick?: () => void;
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
                      onClick={action.onClick}
                      className="flex items-center gap-2"
                    >
                      {content}
                    </a>
                  ) : (
                    <Link href={action.href} onClick={action.onClick} className="flex items-center gap-2">
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
