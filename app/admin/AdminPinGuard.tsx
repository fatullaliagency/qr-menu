"use client";

import { useState, useEffect } from "react";

const MASTER_PIN = "05230715";

export default function AdminPinGuard({
  children,
  restaurantPin,
  storageKey = "qr_admin_auth",
}: {
  children: React.ReactNode;
  restaurantPin?: string;
  storageKey?: string;
}) {
  const [unlocked, setUnlocked] = useState(false);
  const [checked, setChecked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem(storageKey);
    if (saved === "ok") {
      setUnlocked(true);
    }
    setChecked(true);
  }, [storageKey]);

  useEffect(() => {
    if (!unlocked) return;

    const handleFileChange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (!target) return;
      if (!target.dataset.pick) return;
      const file = target.files?.[0];
      if (!file) return;

      const box = target.closest('[data-picker="1"]');
      if (!box) return;
      const hidden = box.querySelector('input[type="hidden"]') as HTMLInputElement;
      const preview = box.querySelector('[data-prev="1"]') as HTMLImageElement;
      const status = box.querySelector('[data-status="1"]') as HTMLElement;

      if (status) status.textContent = "⏳ Hazırlanır...";

      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const max = 800;
          let w = img.width;
          let h = img.height;
          if (w > h) {
            if (w > max) {
              h = Math.round((h * max) / w);
              w = max;
            }
          } else {
            if (h > max) {
              w = Math.round((w * max) / h);
              h = max;
            }
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.78);
          if (hidden) hidden.value = dataUrl;
          if (preview) {
            preview.src = dataUrl;
            preview.style.display = "block";
          }
          if (status) status.textContent = "✓ Şəkil seçildi";
          target.value = "";
        };
        img.src = ev.target?.result as string;
      };
      reader.readAsDataURL(file);
    };

    document.addEventListener("change", handleFileChange);
    return () => document.removeEventListener("change", handleFileChange);
  }, [unlocked]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const entered = pin.trim();
    const expected = restaurantPin ? restaurantPin.trim() : MASTER_PIN;

    if (entered === MASTER_PIN) {
      sessionStorage.setItem(storageKey, "ok");
      setUnlocked(true);
      setError(false);
    } else if (entered === expected) {
      sessionStorage.setItem(storageKey, "ok");
      setUnlocked(true);
      setError(false);
    } else {
      setError(true);
      setPin("");
    }
  };

  if (!checked) return null;

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-[#0b0a09] flex items-center justify-center p-4">
        <form
          onSubmit={handleLogin}
          className="bg-[#141210] border border-[#d4af37]/40 p-8 rounded-3xl shadow-2xl w-full max-w-sm text-center space-y-5"
        >
          <div className="w-16 h-16 mx-auto rounded-full border-2 border-[#d4af37] bg-[#1c1812] flex items-center justify-center text-2xl">
            🔒
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#e5c158]">İdarəetmə Paneli</h1>
            <p className="text-xs text-zinc-400 mt-1">PİN şifrənizi daxil edin</p>
          </div>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••"
            required
            className="w-full text-center text-xl tracking-widest bg-zinc-900 border border-[#d4af37]/40 text-white rounded-xl py-3 px-4"
          />
          {error && <p className="text-xs text-red-400 font-semibold">❌ Yanlış şifrə!</p>}
          <button
            type="submit"
            className="w-full bg-[#d4af37] text-black font-bold py-3 rounded-xl"
          >
            Daxil Ol →
          </button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
