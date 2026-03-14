"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Монтируется на лендинге. Если в localStorage есть stagingai_pending
 * (пользователь вернулся с Робокассы без параметров в URL),
 * редиректит на /studio?paid=true — студия сама восстановит заказ.
 */
export function PendingPaymentRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("stagingai_pending")) {
      router.push("/studio?paid=true");
    }
  }, [router]);

  return null;
}
