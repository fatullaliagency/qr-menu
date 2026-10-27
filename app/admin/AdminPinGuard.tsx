"use client";

import { useState, useEffect } from "react";

const MASTER_PIN = "05230715";

export default function AdminPinGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const [unlocked, setUnlocked] = useState(false);
  const [checked, setChecked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem("qr_admin_auth");
    if (saved === "ok") {
      setUnlocked(true);
    }
    setChecked(true);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === MASTER_PIN) {
      sessionStorage.setItem("qr_admin_auth", "ok");
      setUnlocked(true);
      setError(false);
    } else {
      setError(true);
      setPin("");
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("qr_admin_auth");
    setUnlocked(false);
    setPin("");
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
            <p className="text-xs text-zinc-400 mt-1">
              Daxil olmaq üçün PİN şifrənizi yazın
            </p>
          </div>

          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••"
            required
            className="w-full text-center text-xl tracking-widest bg-zinc-900 border border-[#d4af37]/40 text-white rounded-xl py-3 px-4 focus:outline-none"
          />

          {error && (
            <p className="text-xs text-red-400 font-semibold">
              ❌ Yanlış PİN şifrəsi! Yenidən cəhd edin.
            </p>
          )}

          <button
            type="submit"
            className="w-full bg-[#d4af37] hover:bg-[#e5c158] text-black font-bold py-3 rounded-xl transition"
          >
            Daxil Ol →
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-zinc-900 text-zinc-300 text-xs px-4 py-2 flex justify-between items-center border-b border-zinc-800">
        <span>🛡️ İdarəetmə Rejimi Aktivdir</span>
        <button
          type="button"
          onClick={handleLogout}
          className="bg-red-600/20 hover:bg-red-600/40 text-red-300 px-3 py-1 rounded-lg font-semibold transition"
        >
          🔒 Paneli Kilidlə (Çıxış)
        </button>
      </div>
      {children}
    </div>
  );
}
