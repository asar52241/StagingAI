"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PENDING_PAYMENT_KEY, parsePendingPayment } from "@/lib/paymentFlow";

/**
 * Монтируется на лендинге. Если в localStorage есть stagingai_pending
 * (пользователь вернулся с Робокассы без параметров в URL),
 * редиректит на /studio?paid=true — студия сама восстановит заказ.
 */
export function PendingPaymentRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const pending = parsePendingPayment(localStorage.getItem(PENDING_PAYMENT_KEY));
    if (pending) {
      router.replace("/studio?paid=true");
    }
  }, [router]);

  return null;
}
