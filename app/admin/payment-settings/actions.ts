"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { RestaurantPaymentMode } from "@prisma/client";
import { db } from "@/app/lib/db";
import { getAdminSession } from "@/app/lib/admin-auth";

function value(fd: FormData, key: string): string | null {
  const raw = fd.get(key);
  return typeof raw === "string" ? raw.trim() : null;
}

function validText(value: string | null, max: number): value is string {
  return value !== null && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
}

export async function saveOwnerPaymentSettings(fd: FormData): Promise<void> {
  // Serverdə yoxlama: heç bir restoran ID/slug-u formadan qəbul etmirik.
  const session = await getAdminSession();
  if (!session) redirect("/admin");

  const path = "/admin/payment-settings";
  const legalName = value(fd, "legalName");
  const taxId = value(fd, "taxId");
  const providerName = value(fd, "providerName");
  const providerMerchantId = value(fd, "providerMerchantId");
  const paymentMode = value(fd, "paymentMode");
  const version = value(fd, "version");

  if (
    !validText(legalName, 200) ||
    !validText(taxId, 10) || (taxId !== "" && !/^[0-9]{10}$/.test(taxId)) ||
    !validText(providerName, 100) ||
    !validText(providerMerchantId, 150) ||
    Boolean(providerName) !== Boolean(providerMerchantId) ||
    (paymentMode !== "CASH_ONLY" && paymentMode !== "CASH_AND_CARD") ||
    version === null || (version !== "new" && !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(version))
  ) {
    redirect(path + "?error=validation");
  }

  const restaurant = await db.restaurant.findUnique({
    where: { id: session.restaurantId },
    select: { id: true, slug: true },
  });
  if (!restaurant) redirect("/admin");

  // Köhnə formalar digər sahib/superadmin sessiyasının yeniləməsini silmir.
  const existing = await db.restaurantPaymentSettings.findUnique({
    where: { restaurantId: restaurant.id },
    select: {
      updatedAt: true,
      legalName: true,
      taxId: true,
      paymentMode: true,
      providerName: true,
      providerMerchantId: true,
      approvalStatus: true,
    },
  });

  if ((existing?.updatedAt.toISOString() ?? "new") !== version) {
    redirect(path + "?error=stale");
  }

  const changed = existing && (
    existing.legalName !== (legalName || null) ||
    existing.taxId !== (taxId || null) ||
    existing.paymentMode !== paymentMode ||
    existing.providerName !== (providerName || null) ||
    existing.providerMerchantId !== (providerMerchantId || null)
  );

  const data = {
    legalName: legalName || null,
    taxId: taxId || null,
    paymentMode: paymentMode as RestaurantPaymentMode,
    providerName: providerName || null,
    providerMerchantId: providerMerchantId || null,
    // Provayder təsdiqi owner tərəfindən birbaşa dəyişdirilə bilməz.
    approvalStatus: changed ? ("NOT_SUBMITTED" as const)
      : (existing?.approvalStatus ?? ("NOT_SUBMITTED" as const)),
  };

  if (existing) {
    const updated = await db.restaurantPaymentSettings.updateMany({
      where: { restaurantId: restaurant.id, updatedAt: existing.updatedAt },
      data,
    });
    if (updated.count !== 1) redirect(path + "?error=stale");
  } else {
    try {
      await db.restaurantPaymentSettings.create({
        data: { ...data, restaurantId: restaurant.id },
      });
    } catch (error) {
      // Digər sessiya ilk qeydi artıq yaratmışsa onu üzərindən yazmırıq.
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        redirect(path + "?error=stale");
      }
      throw error;
    }
  }

  revalidatePath(path);
  revalidatePath("/superadmin/restaurants/" + encodeURIComponent(restaurant.slug) + "/payment-settings");
  redirect(path + "?saved=1");
}
