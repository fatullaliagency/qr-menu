import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/app/lib/db";
import { getAdminSession } from "@/app/lib/admin-auth";
import {
  hashRestaurantPin,
  matchesMasterPin,
} from "@/app/lib/pin-security";

async function saveRestaurantPin(formData: FormData) {
  "use server";

  const session = await getAdminSession();

  if (!session) {
    redirect("/admin");
  }

  const masterInput = formData.get("masterPin");
  const pinInput = formData.get("newPin");
  const confirmation = formData.get("confirmPin");

  if (
    typeof masterInput !== "string" ||
    typeof pinInput !== "string" ||
    typeof confirmation !== "string"
  ) {
    redirect("/admin/pin-settings?status=invalid");
  }

  const masterPin = process.env.ADMIN_MASTER_PIN?.trim();

  if (!matchesMasterPin(masterInput, masterPin)) {
    redirect("/admin/pin-settings?status=invalid");
  }

  if (
    !/^\d{6,12}$/.test(pinInput) ||
    pinInput !== confirmation ||
    matchesMasterPin(pinInput, masterPin)
  ) {
    redirect("/admin/pin-settings?status=invalid");
  }

  const existingRestaurant = await db.restaurant.findUnique({
    where: { id: session.restaurantId },
    select: { id: true },
  });

  if (!existingRestaurant) {
    redirect("/admin");
  }

  const pinHash = await hashRestaurantPin(pinInput);

  await db.restaurant.update({
    where: { id: existingRestaurant.id },
    data: { pinCode: pinHash },
  });

  redirect("/admin/pin-settings?status=saved");
}

async function PinSettingsContent({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getAdminSession();

  if (!session) {
    redirect("/admin");
  }

  const restaurant = await db.restaurant.findUnique({
    where: { id: session.restaurantId },
    select: { name: true, slug: true },
  });

  if (!restaurant) {
    redirect("/admin");
  }

  const { status } = await searchParams;

  return (
    <main className="min-h-screen bg-gray-100 p-5">
      <div className="mx-auto max-w-lg rounded-2xl bg-white p-6 shadow">
        <Link href="/admin" className="text-sm text-blue-700">
          ← Admin panelinə qayıt
        </Link>

        <h1 className="mt-5 text-2xl font-bold text-gray-900">
          Restoran PIN ayarları
        </h1>

        <p className="mt-2 text-gray-600">
          Restoran: {restaurant.name}
        </p>

        <p className="mt-1 text-sm text-gray-500">
          {restaurant.slug}
        </p>

        {status === "saved" && (
          <p role="status" className="mt-4 rounded-lg bg-green-100 p-3 text-green-800">
            Yeni PIN uğurla yadda saxlanıldı.
          </p>
        )}

        {status === "invalid" && (
          <p role="alert" className="mt-4 rounded-lg bg-red-100 p-3 text-red-800">
            Məlumatlar yanlışdır. Yenidən yoxlayın.
          </p>
        )}

        <form action={saveRestaurantPin} className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-gray-900">
            Baş administrator PIN-i
            <input
              name="masterPin"
              type="password"
              required
              autoComplete="off"
              className="mt-2 w-full rounded-lg border p-3 text-gray-900"
            />
          </label>

          <label className="block text-sm font-medium text-gray-900">
            Yeni restoran PIN-i (6–12 rəqəm)
            <input
              name="newPin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{6,12}"
              minLength={6}
              maxLength={12}
              required
              autoComplete="new-password"
              className="mt-2 w-full rounded-lg border p-3 text-gray-900"
            />
          </label>

          <label className="block text-sm font-medium text-gray-900">
            Yeni PIN-i təkrar yaz
            <input
              name="confirmPin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{6,12}"
              minLength={6}
              maxLength={12}
              required
              autoComplete="new-password"
              className="mt-2 w-full rounded-lg border p-3 text-gray-900"
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-lg bg-emerald-600 p-3 font-bold text-white"
          >
            Yeni PIN-i yadda saxla
          </button>
        </form>
      </div>
    </main>
  );
}
export default function PinSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-100 p-5">
          <div className="mx-auto max-w-lg rounded-2xl bg-white p-6 shadow">
            <p className="text-gray-600">
              PIN ayarları yüklənir...
            </p>
          </div>
        </main>
      }
    >
      <PinSettingsContent searchParams={searchParams} />
    </Suspense>
  );
}

