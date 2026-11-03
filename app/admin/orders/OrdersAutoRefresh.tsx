"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isLaterOrderMarker, shouldNotifyOfOrder } from "@/app/lib/order-notification-marker";

const REFRESH_MS = 10_000;

type LatestOrder = { id: string; createdAt: string };
type NotificationSnapshot = {
  scope: string;
  newCount: number;
  overdueCount: number;
  latestOrder: LatestOrder | null;
};

/**
 * Sifariş səhifəsi açıq olduqda hər 10 saniyədə sessiya ilə qorunan
 * API-dən yalnız yeni sifariş SAYINI və son sifariş işarəsini alır.
 * Brauzer/səs bildirişi istifadəçi düyməni basana qədər deaktivdir.
 */
export default function OrdersAutoRefresh() {
  const router = useRouter();
  const [newCount, setNewCount] = useState<number | null>(null);
  const [overdueCount, setOverdueCount] = useState<number | null>(null);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [lastAlert, setLastAlert] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [permissionInfo, setPermissionInfo] = useState("");

  const alertsEnabledRef = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);
  const hasBaseline = useRef(false);
  const latestRef = useRef<LatestOrder | null>(null);
  const scopeRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    const controller = new AbortController();

    const poll = async () => {
      if (cancelled || inFlight || !navigator.onLine) return;
      inFlight = true;
      try {
        const response = await fetch("/admin/orders/notifications", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.status === 401) {
          if (!cancelled) {
            setNewCount(null);
            setOverdueCount(null);
            setLastAlert(null);
            // Digər hesaba keçid və sessiya bitməsindən sonra köhnə sifarişin
            // bazası yeni restoranın sifarişi kimi qəbul edilməməlidir.
            hasBaseline.current = false;
            latestRef.current = null;
            scopeRef.current = null;
            setError("Sessiya bitib. Admin panelinə yenidən daxil olun.");
            router.refresh();
          }
          return;
        }
        if (!response.ok) throw new Error("Bildiriş məlumatı alınmadı.");
        const data = (await response.json()) as NotificationSnapshot;
        if (
          typeof data.scope !== "string" ||
          data.scope.length < 1 ||
          data.scope.length > 150 ||
          !Number.isSafeInteger(data.newCount) ||
          data.newCount < 0 ||
          !Number.isSafeInteger(data.overdueCount) ||
          data.overdueCount < 0 ||
          data.overdueCount > data.newCount ||
          (data.latestOrder !== null &&
            (!data.latestOrder ||
              typeof data.latestOrder.id !== "string" ||
              typeof data.latestOrder.createdAt !== "string"))
        ) {
          throw new Error("Yanlış bildiriş məlumatı.");
        }
        if (cancelled) return;

        // A second tab can log in to another restaurant without a 401 here.
        // Never treat that restaurant's existing orders as newly received orders.
        if (scopeRef.current !== null && scopeRef.current !== data.scope) {
          hasBaseline.current = false;
          latestRef.current = null;
          setLastAlert(null);
          alertsEnabledRef.current = false;
          setAlertsEnabled(false);
          setPermissionInfo("Restoran hesabı dəyişdi. Bildirişləri yenidən aktiv edin.");
        }
        scopeRef.current = data.scope;

        const latest = data.latestOrder;
        const isNewOrder = shouldNotifyOfOrder(
          latest, latestRef.current, hasBaseline.current
        );
        if (!hasBaseline.current || isLaterOrderMarker(latest, latestRef.current)) {
          latestRef.current = latest;
        }
        hasBaseline.current = true;

        setNewCount(data.newCount);
        setOverdueCount(data.overdueCount);
        setError("");

        if (isNewOrder) {
          setLastAlert(
            new Date().toLocaleTimeString("az-AZ", { timeZone: "Asia/Baku" })
          );
          if (alertsEnabledRef.current) {
            const audio = audioRef.current;
            if (audio) {
              try {
                void audio.resume().then(() => {
                  const oscillator = audio.createOscillator();
                  const gain = audio.createGain();
                  oscillator.type = "sine";
                  oscillator.frequency.setValueAtTime(820, audio.currentTime);
                  oscillator.frequency.linearRampToValueAtTime(1100, audio.currentTime + 0.18);
                  gain.gain.setValueAtTime(0.05, audio.currentTime);
                  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.25);
                  oscillator.connect(gain);
                  gain.connect(audio.destination);
                  oscillator.start();
                  oscillator.stop(audio.currentTime + 0.26);
                }).catch(() => {});
              } catch {
                // Səs cihazı bloklanarsa mətn bildirişi yenə işləyir.
              }
            }
            if ("Notification" in window && Notification.permission === "granted") {
              try {
                const notice = new Notification("QR Menü — yeni sifariş", {
                  body: "Restoran panelinə yeni sifariş daxil olub.",
                  tag: "qr-menu-new-order",
                });
                notice.onclick = () => {
                  window.focus();
                  window.location.assign("/admin/orders?status=NEW");
                };
              } catch {
                // Brauzer bildirişi dəstəklənməsə, səhifədəki say yenilənir.
              }
            }
          }
        }
        if (document.visibilityState === "visible") router.refresh();
      } catch {
        if (!cancelled && !controller.signal.aborted) {
          setError("Bağlantı yoxlanılır; yeni sifariş sayı müvəqqəti yenilənmir.");
        }
      } finally {
        inFlight = false;
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    const onOnline = () => void poll();
    void poll();
    const interval = window.setInterval(() => void poll(), REFRESH_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [router]);

  useEffect(() => {
    return () => {
      if (audioRef.current) void audioRef.current.close().catch(() => {});
    };
  }, []);

  const toggleAlerts = async () => {
    if (alertsEnabledRef.current) {
      alertsEnabledRef.current = false;
      setAlertsEnabled(false);
      setPermissionInfo("Səsli bildirişlər söndürülüb.");
      return;
    }

    // İcazə sorğusu yalnız istifadəçi bu düyməni basdıqda göstərilir.
    let askPermission: Promise<NotificationPermission> | null = null;
    if ("Notification" in window && Notification.permission === "default") {
      try {
        askPermission = Notification.requestPermission();
      } catch {
        // Bəzi brauzerlər icazə sorğusunu rədd edə bilər; səs seçimi işləyir.
      }
    }
    try {
      if (!audioRef.current && "AudioContext" in window) {
        audioRef.current = new AudioContext();
      }
      if (audioRef.current) await audioRef.current.resume();
    } catch {
      setPermissionInfo("Səs bu brauzerdə mümkün deyil; mətn bildirişi aktivdir.");
    }
    alertsEnabledRef.current = true;
    setAlertsEnabled(true);
    if (askPermission) {
      try { await askPermission; } catch { /* Brauzer icazə verməyə bilər. */ }
    }
    if ("Notification" in window && Notification.permission === "granted") {
      setPermissionInfo("Səs və brauzer bildirişləri aktivdir.");
    } else {
      setPermissionInfo("Səs (dəstəklənirsə) aktivdir; brauzer bildirişinə icazə yoxdur.");
    }
  };

  return (
    <section className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">
            Yeni sifarişlər: {newCount === null ? "Yoxlanılır..." : newCount}
          </h2>
          <p className="mt-1 text-sm">
            10 dəqiqədən çox təsdiqsiz: <strong>{overdueCount === null ? "Yoxlanılır..." : overdueCount}</strong>
          </p>
          <p className="mt-1 text-sm">
            Panel hər 10 saniyədə yoxlanılır. Səs və brauzer bildirişi istəyə bağlıdır.
          </p>
          {lastAlert && (
            <p className="mt-2 font-semibold" role="status">
              🔔 Yeni sifariş gəldi! Son bildiriş: {lastAlert}
            </p>
          )}
          {error && <p className="mt-2 text-sm text-red-800" role="alert">{error}</p>}
          {permissionInfo && <p className="mt-2 text-xs">{permissionInfo}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/orders?urgent=1"
            className="rounded-lg bg-amber-700 px-3 py-2 text-sm font-semibold text-white"
          >
            Gecikən sifarişlər
          </Link>
          <Link
            href="/admin/orders?status=NEW"
            className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white"
          >
            Yeni sifarişlərə bax
          </Link>
          <button
            type="button"
            onClick={() => void toggleAlerts()}
            aria-pressed={alertsEnabled}
            className="rounded-lg border border-emerald-700 px-3 py-2 text-sm font-semibold"
          >
            {alertsEnabled ? "🔕 Bildirişi söndür" : "🔔 Bildirişi aktiv et"}
          </button>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="rounded-lg border border-emerald-700 px-3 py-2 text-sm font-semibold"
          >
            İndi yenilə
          </button>
        </div>
      </div>
    </section>
  );
}
