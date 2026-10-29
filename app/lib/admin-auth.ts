
"use server";

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

const INVALID_LOGIN =
  "Restoran və ya PİN kod yanlışdır.";

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

  const masterPin =
    process.env.ADMIN_MASTER_PIN?.trim();

  const masterPinValid = matchesMasterPin(
    pin,
    masterPin
  );

  const restaurantPinValid =
    await verifyRestaurantPin(
      pin,
      restaurant.pinCode
    );

  if (!masterPinValid && !restaurantPinValid) {
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
