"use client";

import { useState, useEffect } from "react";

export default function AdminPinGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  // Brauzerdə bir dəfə şifrə yazıldıqda yadda saxlayır
  useEffect(() => {
    const saved = sessionStorage.getItem("admin_unlocked");
    if (saved === "true") {
      setIsUnlocked(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === "05230715") {
      sessionStorage.setItem("admin_unlocked", "true");
      setIsUnlocked(true);
      setError(false);
    } else {
      setError(true);
    }
  };

  if (isUnlocked) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-6 text-white">
      <div className="bg-zinc-800 border border-zinc-700 p-8 rounded-3xl max-w-sm w-full shadow-2xl text-center space-y-6">
        <div className="text-4xl">🔒</div>
        <div>
          <h1 className="text-2xl font-bold">İdarəetmə Paneli</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Davam etmək üçün giriş şifrəsini daxil edin
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-500"
            required
          />
          {error && (
            <p className="text-red-400 text-xs font-medium">
              ❌ Yanlış şifrə! Yenidən cəhd edin.
            </p>
          )}
          <button
            type="submit"
            className="w-full bg-emerald-500 text-zinc-950 font-bold py-3 rounded-xl hover:bg-emerald-400 transition"
          >
            Daxil Ol →
          </button>
        </form>
      </div>
    </div>
  );
}