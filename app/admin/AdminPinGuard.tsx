"use client";

import { useState, useEffect } from "react";

const MASTER_PIN = "05230715";

export default function AdminPinGuard({
  children,
  restaurantPin,
  storageKey = "qr_admin_ok",
}: {
  children: React.ReactNode;
  restaurantPin?: string;
  storageKey?: string;
}) {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem(storageKey);
    if (saved === "1") {
      setUnlocked(true);
    }
  }, [storageKey]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = pin.trim();
    const isMaster = clean === MASTER_PIN;
    const isOwner = restaurantPin ? clean === restaurantPin.trim() : false;

    if (isMaster) {
      sessionStorage.setItem(storageKey, "1");
      setUnlocked(true);
      setError(false);
    } else if (isOwner) {
      sessionStorage.setItem(storageKey, "1");
      setUnlocked(true);
      setError(false);
    } else {
      setError(true);
      setPin("");
    }
  };

  if (unlocked) return <>{children}</>;

  return (
    <div className="min-h-screen bg-[#0b0a09] flex items-center justify-center p-4">
      <form
        onSubmit={handleLogin}
        className="bg-[#141210] border border-[#d4af37]/40 p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center space-y-5"
      >
        <div className="w-16 h-16 mx-auto rounded-full border-2 border-[#d4af37] bg-[#1c1710] flex items-center justify-center text-2xl">
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
          className="w-full bg-zinc-900 border border-[#d4af37]/40 rounded-xl px-4 py-3 text-center text-white text-lg tracking-widest focus:outline-none"
        />

        {error && (
          <p className="text-xs text-red-400 font-bold">❌ Yanlış PİN şifrəsi!</p>
        )}

        <button
          type="submit"
          className="w-full bg-[#d4af37] hover:bg-[#e5c158] text-black font-bold py-3 rounded-xl"
        >
          Daxil Ol →
        </button>
      </form>
    </div>
  );
}
