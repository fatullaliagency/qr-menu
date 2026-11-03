"use client";

import { useEffect, useState } from "react";
import type { OrderStatus, PaymentStatus } from "@prisma/client";
import { shouldPollCustomerStatus } from "@/app/lib/customer-tracking-poll";

type Status = {
  status: OrderStatus;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  updatedAt: string;
};

const STEPS: { status: OrderStatus; title: string }[] = [
  { status: "NEW", title: "Sifariş göndərildi" },
  { status: "CONFIRMED", title: "Restoran təsdiqlədi" },
  { status: "PREPARING", title: "Hazırlanır" },
  { status: "ON_THE_WAY", title: "Çatdırılma yolundadır" },
  { status: "DELIVERED", title: "Çatdırıldı" },
];
const REFRESH_MS = 10_000;

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Ödəniş gözlənilir",
  AWAITING_VERIFICATION: "Təsdiq gözlənilir",
  PAID: "Ödənilib",
  FAILED: "Uğursuz",
  REFUNDED: "Geri qaytarılıb",
};

export default function LiveOrderStatus({
  orderId,
  token,
  initial,
}: {
  orderId: string;
  token: string;
  initial: Status;
}) {
  const [state, setState] = useState(initial);
  const [error, setError] = useState(false);
  const [offline, setOffline] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    let linkInvalid = false;
    const controller = new AbortController();

    // On an in-place change to a different order, do not show an old result.
    setState(initial);
    setError(false);
    setInvalidLink(false);
    setLastChecked(null);

    const refresh = async () => {
      if (!active) return;
      const onlineNow = navigator.onLine;
      setOffline(!onlineNow);
      if (!shouldPollCustomerStatus(
        document.visibilityState === "visible",
        onlineNow,
        inFlight,
        linkInvalid
      )) return;

      inFlight = true;
      try {
        const response = await fetch(
          "/order/track/" +
            encodeURIComponent(orderId) +
            "/status?t=" +
            encodeURIComponent(token),
          { cache: "no-store", credentials: "same-origin", signal: controller.signal }
        );
        if (response.status === 404) {
          linkInvalid = true;
          if (active) {
            setInvalidLink(true);
            setError(false);
          }
          return;
        }
        if (!response.ok) throw new Error("Status unavailable");

        const next = (await response.json()) as Status;
        if (
          !next ||
          ![...STEPS.map((step) => step.status), "CANCELLED"].includes(next.status) ||
          !Object.prototype.hasOwnProperty.call(PAYMENT_LABELS, next.paymentStatus) ||
          typeof next.paymentMethod !== "string" ||
          typeof next.updatedAt !== "string"
        ) {
          throw new Error("Invalid tracking response");
        }

        if (active) {
          setState(next);
          setError(false);
          setLastChecked(new Date().toLocaleTimeString("az-AZ", {
            timeZone: "Asia/Baku",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }));
        }
      } catch {
        if (active && !controller.signal.aborted) setError(true);
      } finally {
        inFlight = false;
      }
    };

    const onOnline = () => {
      if (active) setOffline(false);
      void refresh();
    };
    const onOffline = () => {
      if (active) setOffline(true);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };

    setOffline(!navigator.onLine);
    void refresh();
    const interval = window.setInterval(() => void refresh(), REFRESH_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [orderId, token, initial]);

  const cancelled = state.status === "CANCELLED";
  const current = STEPS.findIndex((step) => step.status === state.status);

  return (
    <section className="space-y-5">
      <p className="text-sm text-zinc-500">
        Sifariş #{orderId.slice(-8)} · Təxminən hər 10 saniyədə yenilənir
      </p>
      {lastChecked && (
        <p className="text-xs text-zinc-500" role="status">
          Son uğurlu yoxlama: {lastChecked} (Bakı vaxtı)
        </p>
      )}

      {cancelled && (
        <p className="rounded-xl border border-red-300 bg-red-50 p-4 font-semibold text-red-700">
          Bu sifariş restoran tərəfindən ləğv edilib.
        </p>
      )}
      {invalidLink && (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-900">
          Sifariş izləmə bağlantısı artıq etibarlı deyil. Restoranla əlaqə saxlayın.
        </p>
      )}
      {offline && (
        <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          İnternet bağlantısı yoxdur. Son məlum sifariş vəziyyəti göstərilir.
        </p>
      )}
      {error && !offline && !invalidLink && (
        <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Hazırda yenilənmə mümkün deyil. Bağlantını yoxlayın.
        </p>
      )}

      <div className="space-y-4">
        {STEPS.map((step, index) => {
          const done = !cancelled && index <= current;
          return (
            <div key={step.status} className="flex items-center gap-3">
              <div
                className={
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border font-bold " +
                  (done
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-zinc-300 bg-white text-zinc-500")
                }
              >
                {done ? "✓" : index + 1}
              </div>
              <p className={done ? "font-semibold text-zinc-900" : "text-zinc-500"}>
                {step.title}
              </p>
            </div>
          );
        })}
      </div>
      <div className="rounded-xl bg-zinc-100 p-4 text-sm text-zinc-800">
        <p>Ödəniş: {state.paymentMethod === "CASH" ? "Nağd" : state.paymentMethod}</p>
        <p>Ödəniş vəziyyəti: {PAYMENT_LABELS[state.paymentStatus]}</p>
      </div>
    </section>
  );
}
