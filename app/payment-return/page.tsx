"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PAYMENT_RETURN_EVENT_KEY, STUDIO_TAB_MARKER_KEY } from "@/lib/paymentFlow";

export default function PaymentReturnPage() {
  const searchParams = useSearchParams();
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const nextHref = useMemo(() => {
    const search = searchParams.toString();
    return search ? `/studio?${search}` : "/studio";
  }, [searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const sameStudioTab = window.sessionStorage.getItem(STUDIO_TAB_MARKER_KEY) === "1";
    setShouldRedirect(sameStudioTab);

    localStorage.setItem(
      PAYMENT_RETURN_EVENT_KEY,
      JSON.stringify({ search: window.location.search, ts: Date.now() }),
    );

    const closeTimer = sameStudioTab
      ? undefined
      : window.setTimeout(() => {
          window.close();
        }, 150);

    const redirectTimer = sameStudioTab
      ? window.setTimeout(() => {
          window.location.replace(nextHref);
        }, 500)
      : undefined;

    return () => {
      if (closeTimer) window.clearTimeout(closeTimer);
      if (redirectTimer) window.clearTimeout(redirectTimer);
    };
  }, [nextHref]);

  const isFailed = searchParams.get("paid") === "false";

  return (
    <main className="min-h-screen bg-[#080911] px-6 py-12 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-2xl items-center justify-center">
        <div className="w-full rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06]">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className={isFailed ? "text-amber-300" : "text-emerald-300"}
            >
              {isFailed ? (
                <>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v5m0 3h.01" strokeLinecap="round" strokeLinejoin="round" />
                </>
              ) : (
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              )}
            </svg>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">
            {isFailed ? "Возвращаем вас в Studio" : "Оплата принята"}
          </h1>

          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-white/70">
            {isFailed
              ? "Восстановим текущий заказ, чтобы вы могли повторить попытку оплаты без повторной загрузки фото."
              : shouldRedirect
              ? "Возвращаем вас обратно в Studio, чтобы сразу продолжить обработку."
              : "Передаём подтверждение в открытую вкладку Studio. Эту вкладку можно просто закрыть."}
          </p>

          <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-xs uppercase tracking-[0.18em] text-white/55">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white/70" />
            {shouldRedirect ? "Переход произойдёт автоматически" : "Возврат уже отправлен в Studio"}
          </div>

          <div className="mt-8">
            <Link
              href={nextHref}
              className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/10 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/15"
            >
              Открыть Studio вручную
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
