"use client";

import { useState } from "react";

type KitchenLine = { name: string; quantity: number };

/**
 * Mətbəx üçün yalnız məhsulun adı və sayı kopyalanır.
 * Müştəri adı, telefon, ünvan və ödəniş məlumatı ötürülmür.
 */
export default function CopyKitchenOrderButton({
  orderId,
  destinationLabel,
  items,
}: {
  orderId: string;
  destinationLabel: string;
  items: KitchenLine[];
}) {
  const [status, setStatus] = useState<"idle" | "copying" | "copied" | "error">("idle");

  async function copy() {
    if (status === "copying") return;
    const text = [
      `Sifariş #${orderId.slice(-8)}`,
      destinationLabel,
      ...items.map((item) => `${item.quantity} × ${item.name}`),
    ].join("\n");

    if (!navigator.clipboard?.writeText) {
      setStatus("error");
      return;
    }

    setStatus("copying");
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => void copy()}
        disabled={status === "copying"}
        className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-60"
      >
        {status === "copying" ? "Kopyalanır..." : "Mətbəx üçün siyahını kopyala"}
      </button>
      <span className="text-xs text-zinc-600" role="status" aria-live="polite">
        {status === "copied"
          ? "Məhsul siyahısı kopyalandı."
          : status === "error"
            ? "Kopyalama mümkün olmadı. Məhsulları əl ilə seçib kopyalayın."
            : "Yalnız məhsullar və miqdarlar kopyalanır."}
      </span>
    </div>
  );
}
