"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Поддерживает возврат Робокассы на старый адрес лендинга.
 * Сохранённая попытка оплаты сама по себе не означает возврат с оплаты:
 * обычный переход на главную всегда должен открывать лендинг.
 */
export function PendingPaymentRedirect() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paid = params.get("paid");
    if (paid !== "true" && paid !== "false" && !params.has("InvId")) return;

    // Preserve the invoice, exact signed amount, signature and cancellation flag.
    // The studio verifies payment on the server before allowing processing.
    router.replace(`/studio?${params.toString()}`);
  }, [router]);

  return null;
}
