
"use server";

import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { headers } from "next/headers";

import { db } from "@/app/lib/db";

import {
  createAdminSession,
  deleteAdminSession,
} from "@/app/lib/admin-auth";

import {
  matchesMasterPin,
  verifyRestaurantPin,
} from "@/app/lib/pin-security";

type LoginResult = {
  success: boolean;
  message: string;
};

type AttemptRow = {
  failedAttempts: number;
  blockedUntil: Date | null;
  updatedAt: Date;
};

const MAX_ATTEMPTS = 5;
const BLOCK_MS = 15 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;

const INVALID_LOGIN =
  "Restoran və ya PİN kod yanlışdır.";

const BLOCKED_LOGIN =
  "Çox sayda yanlış cəhd. 15 dəqiqə sonra yenidən yoxlayın.";

const UNAVAILABLE =
  "Giriş müvəqqəti mümkün deyil. Yenidən cəhd edin.";

async function getClientIp(): Promise<string | null> {
  const requestHeaders = await headers();

  // Production mühitində yalnız Vercel-in
  // təqdim etdiyi IP başlığına etibar edirik.
  const forwarded =
    requestHeaders.get("x-vercel-forwarded-for");

  const ip = forwarded?.split(",")[0]?.trim();

  if (ip && isIP(ip)) {
    return ip;
  }

  // Lokal inkişaf mühitində test üçün.
  if (process.env.NODE_ENV !== "production") {
    return "local-development";
  }

  // Etibarlı IP yoxdursa, qorunmanı keçmirik.
  return null;
}

function createAttemptKey(
  slug: string,
  ip: string
): string {
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!secret) {
    throw new Error(
      "ADMIN_SESSION_SECRET təyin edilməyib."
    );
  }

  return createHmac("sha256", secret)
    .update(`admin-login:v1:${slug}:${ip}`)
    .digest("hex");
}

export async function loginAdmin(
  formData: FormData
): Promise<LoginResult> {
  const slugInput = formData.get("slug");
  const pinInput = formData.get("pin");

  if (
    typeof slugInput !== "string" ||
    typeof pinInput !== "string"
  ) {
    return {
      success: false,
      message: INVALID_LOGIN,
    };
  }

  const slug = slugInput.trim();
  const pin = pinInput.trim();

  if (
    !slug ||
    slug.length > 120 ||
    !pin ||
    pin.length > 128
  ) {
    return {
      success: false,
      message: INVALID_LOGIN,
    };
  }

  const ip = await getClientIp();

  if (!ip) {
    return {
      success: false,
      message: UNAVAILABLE,
    };
  }

  const key = createAttemptKey(slug, ip);
  const currentTime = new Date();

  // Bloklanmış girişlər üçün bahalı scrypt
  // yoxlamasını təkrar icra etmirik.
  const existingAttempt =
    await db.adminLoginAttempt.findUnique({
      where: { key },
      select: { blockedUntil: true },
    });

  if (
    existingAttempt?.blockedUntil &&
    existingAttempt.blockedUntil > currentTime
  ) {
    return {
      success: false,
      message: BLOCKED_LOGIN,
    };
  }

  const restaurant = await db.restaurant.findUnique({
    where: { slug },
    select: {
      id: true,
      pinCode: true,
    },
  });

  const masterPin =
    process.env.ADMIN_MASTER_PIN?.trim();

  const masterPinValid = restaurant
    ? matchesMasterPin(pin, masterPin)
    : false;

  const restaurantPinValid = restaurant
    ? await verifyRestaurantPin(
        pin,
        restaurant.pinCode
      )
    : false;

  const validPin =
    masterPinValid || restaurantPinValid;

  // Hər IP/restoran açarı üçün sətri
  // tranzaksiya daxilində kilidləyirik.
  // Beləliklə paralel cəhdlər sayğacı
  // bir-birinin üzərinə yazmır.
  const outcome = await db.$transaction(
    async (tx) => {
      await tx.$executeRaw`
        INSERT INTO public."AdminLoginAttempt"
          ("key", "failedAttempts",
           "blockedUntil", "updatedAt")
        VALUES
          (${key}, 0, NULL, CURRENT_TIMESTAMP)
        ON CONFLICT ("key") DO NOTHING
      `;

      const rows = await tx.$queryRaw<AttemptRow[]>`
        SELECT
          "failedAttempts",
          "blockedUntil",
          "updatedAt"
        FROM public."AdminLoginAttempt"
        WHERE "key" = ${key}
        FOR UPDATE
      `;

      const attempt = rows[0];

      if (!attempt) {
        throw new Error(
          "Giriş cəhdi sətri tapılmadı."
        );
      }

      const now = new Date();

      if (
        attempt.blockedUntil &&
        attempt.blockedUntil > now
      ) {
        return "blocked" as const;
      }

      if (validPin) {
        await tx.adminLoginAttempt.update({
          where: { key },
          data: {
            failedAttempts: 0,
            blockedUntil: null,
          },
        });

        return "success" as const;
      }

      const lockExpired =
        attempt.blockedUntil !== null &&
        attempt.blockedUntil <= now;

      const windowExpired =
        now.getTime() -
          attempt.updatedAt.getTime() >=
        WINDOW_MS;

      const resetCounter =
        lockExpired || windowExpired;

      const failures = resetCounter
        ? 1
        : attempt.failedAttempts + 1;

      const blockedUntil =
        failures >= MAX_ATTEMPTS
          ? new Date(now.getTime() + BLOCK_MS)
          : null;

      await tx.adminLoginAttempt.update({
        where: { key },
        data: {
          failedAttempts: failures,
          blockedUntil,
        },
      });

      return failures >= MAX_ATTEMPTS
        ? ("blocked" as const)
        : ("invalid" as const);
    },
    {
      maxWait: 5000,
      timeout: 10000,
    }
  );

  if (outcome === "blocked") {
    return {
      success: false,
      message: BLOCKED_LOGIN,
    };
  }

  if (outcome !== "success" || !restaurant) {
    return {
      success: false,
      message: INVALID_LOGIN,
    };
  }

  await createAdminSession(restaurant.id);

  return {
    success: true,
    message: "Giriş uğurludur.",
  };
}

export async function logoutAdmin(): Promise<void> {
  await deleteAdminSession();
}
