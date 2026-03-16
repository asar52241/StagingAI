"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const YANDEX_METRIKA_ID = 107727165;

type YmFunction = (...args: unknown[]) => void;

declare global {
  interface Window {
    ym?: YmFunction;
  }
}

export function YandexMetrikaPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const isFirstPageView = useRef(true);
  const lastTrackedUrl = useRef<string | null>(null);

  useEffect(() => {
    const currentUrl = `${window.location.origin}${pathname}${search ? `?${search}` : ""}`;

    if (isFirstPageView.current) {
      isFirstPageView.current = false;
      lastTrackedUrl.current = currentUrl;
      return;
    }

    if (!window.ym || lastTrackedUrl.current === currentUrl) {
      return;
    }

    window.ym(YANDEX_METRIKA_ID, "hit", currentUrl, {
      referer: lastTrackedUrl.current ?? document.referrer,
      title: document.title,
    });

    lastTrackedUrl.current = currentUrl;
  }, [pathname, search]);

  return null;
}
