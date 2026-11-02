import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "qr_superadmin_session";
const DURATION_SECONDS = 60 * 60 * 2;
const SESSION_CONTEXT = "qr-menu:superadmin:session:v1:";

export function isSuperAdminEnabled(): boolean {
  return (
    process.env.ENABLE_SUPERADMIN_PANEL === "true" &&
    (process.env.SUPERADMIN_ACCESS_KEY?.length ?? 0) >= 32
  );
}

function secret(): string {
  const value = process.env.SUPERADMIN_ACCESS_KEY;
  if (!value || value.length < 32) {
    throw new Error("Super Admin giriş açarı konfiqurasiya olunmayıb.");
  }
  return value;
}

function signature(payload: string): Buffer {
  return createHmac("sha256", secret())
    .update(SESSION_CONTEXT + payload)
    .digest();
}

export async function hasSuperAdminSession(): Promise<boolean> {
  if (!isSuperAdminEnabled()) return false;
  const cookie = (await cookies()).get(COOKIE)?.value;
  if (!cookie) return false;

  const parts = cookie.split(".");
  if (parts.length !== 2) return false;

  const [expires, mac] = parts;
  if (!/^\d{13}$/.test(expires) || !/^[0-9a-f]{64}$/.test(mac)) return false;
  if (Number(expires) <= Date.now()) return false;

  const expected = signature(expires);
  const submitted = Buffer.from(mac, "hex");
  return timingSafeEqual(expected, submitted);
}

export async function establishSuperAdminSession(): Promise<void> {
  if (!isSuperAdminEnabled()) throw new Error("Super Admin deaktivdir.");
  const expires = String(Date.now() + DURATION_SECONDS * 1000);
  const value = expires + "." + signature(expires).toString("hex");
  (await cookies()).set(COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/superadmin",
    maxAge: DURATION_SECONDS,
  });
}

export async function clearSuperAdminSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
