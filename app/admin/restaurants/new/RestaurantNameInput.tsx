"use client";

import { useState } from "react";
import { restaurantSlugFromName } from "@/app/lib/restaurant-slug";

export default function RestaurantNameInput({
  className,
  labelClassName = "block text-sm font-semibold",
  placeholder = "Məsələn: Qoşa Samovar",
}: {
  className: string;
  labelClassName?: string;
  placeholder?: string;
}) {
  const [name, setName] = useState("");
  const slug = name.trim() ? restaurantSlugFromName(name) : "restoran-adi";
  return (
    <div>
      <label className={labelClassName}>
        Restoranın adı
        <input name="name" required minLength={2} maxLength={120}
          placeholder={placeholder} className={className}
          value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <p className="mt-2 break-all text-xs text-zinc-600" aria-live="polite">
        Gələcək menyu ünvanı: <strong>menyular.az/{slug}</strong>
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        URL avtomatik yaradılır. Bu ad artıq varsa, sistem -2, -3 əlavə edəcək.
        Domen qoşulduqdan sonra ünvan işləyəcək.
      </p>
    </div>
  );
}
