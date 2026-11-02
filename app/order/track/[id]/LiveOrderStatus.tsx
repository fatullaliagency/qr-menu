"use client";

import { useEffect, useState } from "react";
import type { OrderStatus, PaymentStatus } from "@prisma/client";

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

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const response = await fetch(
          "/order/track/" +
            encodeURIComponent(orderId) +
            "/status?t=" +
            encodeURIComponent(token),
          { cache: "no-store" }
        );
        if (!response.ok) throw new Error("Status unavailable");
        const next = (await response.json()) as Status;
        if (active) {
          setState(next);
          setError(false);
        }
      } catch {
        if (active) setError(true);
      }
    };
    const interval = setInterval(refresh, 10000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [orderId, token]);

  const cancelled = state.status === "CANCELLED";
  const current = STEPS.findIndex((step) => step.status === state.status);

  return (
    <section className="space-y-5">
      <p className="text-sm text-zinc-500">
        Sifariş #{orderId.slice(-8)} · Təxminən hər 10 saniyədə yenilənir
      </p>

      {cancelled && (
        <p className="rounded-xl border border-red-300 bg-red-50 p-4 font-semibold text-red-700">
          Bu sifariş restoran tərəfindən ləğv edilib.
        </p>
      )}

      {error && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
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
        <p>Ödəniş vəziyyəti: {state.paymentStatus}</p>
      </div>
    </section>
  );
}
