"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const REFRESH_MS = 10_000;

/**
 * Restoran idarəetmə ekranı açıq olduqda yeni sifarişləri
 * F5 basmadan göstərir. Məlumatların yüklənməsi yalnız
 * sessiya ilə qorunan server səhifəsində aparılır.
 */
export default function OrdersAutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        router.refresh();
      }
    };

    const intervalId = window.setInterval(refreshWhenVisible, REFRESH_MS);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("online", refreshWhenVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("online", refreshWhenVisible);
    };
  }, [router]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
      <p>
        Son 50 sifariş göstərilir. Panel açıq olduqda hər 10 saniyədə
        avtomatik yenilənir.
      </p>
      <button
        type="button"
        onClick={() => router.refresh()}
        className="rounded-lg border border-emerald-600 px-3 py-2 font-semibold text-emerald-800 hover:bg-emerald-100"
      >
        İndi yenilə
      </button>
    </div>
  );
}
