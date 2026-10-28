
"use client";

import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { loginAdmin, logoutAdmin } from "./auth-actions";

type AdminPinGuardProps = {
  children: ReactNode;
  restaurantSlug?: string;
  initialAuthenticated?: boolean;

  // Köhnə səhifələrlə müvəqqəti uyğunluq üçündür.
  // Bu dəyərlər autentifikasiyada istifadə edilmir.
  restaurantPin?: string;
  storageKey?: string;
};

export default function AdminPinGuard({
  children,
  restaurantSlug,
  initialAuthenticated = false,
}: AdminPinGuardProps) {
  const [unlocked, setUnlocked] = useState(
    initialAuthenticated
  );

  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialAuthenticated) {
      setUnlocked(true);
    }
  }, [initialAuthenticated]);

  const handleLogin = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (loading) return;

    setError("");

    const enteredPin = pin.trim();

    if (!enteredPin) {
      setError("PİN kodunu daxil edin.");
      return;
    }

    setLoading(true);

    try {
      const params = new URLSearchParams(
        window.location.search
      );

      const slug =
        restaurantSlug ||
        params.get("slug") ||
        "fatullali";

      const formData = new FormData();

      formData.set("slug", slug);
      formData.set("pin", enteredPin);

      const result = await loginAdmin(formData);

      if (result.success) {
        setUnlocked(true);
        setPin("");
        setError("");
      } else {
        setPin("");
        setError(result.message);
      }
    } catch {
      setPin("");
      setError(
        "Giriş zamanı xəta baş verdi. Yenidən cəhd edin."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (loading) return;

    setLoading(true);

    try {
      await logoutAdmin();
      setUnlocked(false);
      setPin("");
      setError("");
    } catch {
      setError("Çıxış zamanı xəta baş verdi.");
    } finally {
      setLoading(false);
    }
  };

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
            <h1 className="text-xl font-bold text-[#e5c158]">
              İdarəetmə Paneli
            </h1>

            <p className="text-xs text-zinc-400 mt-1">
              PİN şifrənizi daxil edin
            </p>
          </div>

          <input
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            value={pin}
            onChange={(event) => {
              setPin(event.target.value);
              if (error) setError("");
            }}
            placeholder="••••"
            required
            disabled={loading}
            aria-label="Admin PİN kodu"
            className="w-full text-center text-xl tracking-widest bg-zinc-900 border border-[#d4af37]/40 text-white rounded-xl py-3 px-4 outline-none focus:border-[#d4af37] disabled:opacity-60"
          />

          {error && (
            <p
              role="alert"
              className="text-xs text-red-400 font-semibold"
            >
              ❌ {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#d4af37] text-black font-bold py-3 rounded-xl hover:bg-[#e5c158] transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Yoxlanılır..." : "Daxil Ol →"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <>
      <div className="fixed top-3 right-3 z-50">
        <button
          type="button"
          onClick={handleLogout}
          disabled={loading}
          className="bg-zinc-900 text-white border border-zinc-700 text-xs font-semibold px-3 py-2 rounded-lg shadow-lg hover:bg-zinc-800 disabled:opacity-60"
        >
          {loading ? "Gözləyin..." : "Çıxış"}
        </button>
      </div>

      {children}
    </>
  );
}
