"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { shouldKitchenAutoRefresh } from "@/app/lib/kitchen-refresh";

const INTERVAL_MS = 10_000;

export default function KitchenScreenRefresh() {
  const router = useRouter();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [online, setOnline] = useState(true);
  const [lastRequest, setLastRequest] = useState<string | null>(null);

  const refreshNow = useCallback(() => {
    if (!navigator.onLine) {
      setOnline(false);
      return;
    }
    setLastRequest(new Date().toLocaleTimeString("az-AZ", {
      timeZone: "Asia/Baku",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }));
    router.refresh();
  }, [router]);

  useEffect(() => {
    const onVisible = () => {
      if (shouldKitchenAutoRefresh(
        autoRefresh,
        document.visibilityState === "visible",
        navigator.onLine
      )) refreshNow();
    };
    const onOnline = () => {
      setOnline(true);
      onVisible();
    };
    const onOffline = () => setOnline(false);

    // A screen opened while already offline will not receive a new offline event.
    if (!navigator.onLine) setOnline(false);

    const timer = window.setInterval(onVisible, INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [router, autoRefresh, refreshNow]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => setAutoRefresh((enabled) => !enabled)}
        aria-pressed={autoRefresh}
        className={autoRefresh
          ? "rounded-lg border border-indigo-700 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-900"
          : "rounded-lg border border-amber-500 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900"}
      >
        {autoRefresh ? "⏸ Avto-yenilənməni dayandır" : "▶ Avto-yenilənməni başlat"}
      </button>
      <button
        type="button"
        onClick={refreshNow}
        disabled={!online}
        className="rounded-lg bg-indigo-800 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        İndi yenilə
      </button>
      <span className="text-xs text-zinc-600" role="status" aria-live="polite">
        {!online
          ? "İnternet bağlantısı yoxdur"
          : autoRefresh
            ? "Avtomatik: 10 saniyədə bir"
            : "Avtomatik yenilənmə dayandırılıb"}
        {lastRequest && <> · Son yeniləmə sorğusu: {lastRequest}</>}
      </span>
    </div>
  );
}
