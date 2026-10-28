
"use server";

import {
  createHash,
  timingSafeEqual,
} from "node:crypto";

import { db } from "@/app/lib/db";
import {
  createAdminSession,
  deleteAdminSession,
} from "@/app/lib/admin-auth";

type LoginResult = {
  success: boolean;
  message: string;
};

const INVALID_LOGIN = "Restoran və ya PİN kod yanlışdır.";

function matchesPin(
  entered: string,
  expected: string | null | undefined
): boolean {
  if (!expected) {
    return false;
  }

  const enteredHash = createHash("sha256")
    .update(entered, "utf8")
    .digest();

  const expectedHash = createHash("sha256")
    .update(expected, "utf8")
    .digest();

  return timingSafeEqual(enteredHash, expectedHash);
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

  const restaurant = await db.restaurant.findUnique({
    where: { slug },
    select: {
      id: true,
      pinCode: true,
    },
  });

  if (!restaurant) {
    return {
      success: false,
      message: INVALID_LOGIN,
    };
  }

  const masterPin = process.env.ADMIN_MASTER_PIN?.trim();

  const restaurantPinValid = matchesPin(
    pin,
    restaurant.pinCode
  );

  const masterPinValid = matchesPin(
    pin,
    masterPin
  );

  if (!restaurantPinValid && !masterPinValid) {
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
