"use client";

const YANDEX_METRIKA_ID = 107727165;

type YmFunction = (...args: unknown[]) => void;

type GoalParams = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    ym?: YmFunction;
  }
}

export function trackMetrikaGoal(target: string, params?: GoalParams) {
  if (typeof window === "undefined" || typeof window.ym !== "function") {
    return;
  }

  window.ym(YANDEX_METRIKA_ID, "reachGoal", target, params ?? {});
}
