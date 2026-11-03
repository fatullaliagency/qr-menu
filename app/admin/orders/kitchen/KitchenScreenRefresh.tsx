"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const INTERVAL_MS = 10_000;

export default function KitchenScreenRefresh() {
  const router = useRouter();

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        router.refresh();
      }
    };
    const timer = window.setInterval(onVisible, INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  return (
    <button type="button" onClick={() => router.refresh()}
      className="rounded-lg bg-indigo-800 px-4 py-2 font-semibold text-white hover:bg-indigo-700">
      İndi yenilə
    </button>
  );
}
