"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/app/lib/db";
import { hasSuperAdminSession } from "@/app/lib/superadmin-auth";
import type { RestaurantPaymentMode } from "@prisma/client";

function value(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : null;
}

export async function saveRestaurantPaymentSettings(fd: FormData): Promise<void> {
  // Mütləq serverdə yoxlanılır; səhifədəki gizli sahələrə etibar edilmir.
  if (!(await hasSuperAdminSession())) redirect("/superadmin");

  const slug = value(fd, "slug") ?? "";
  if (!/^[a-z0-9][a-z0-9-]{1,158}[a-z0-9]$/.test(slug)) redirect("/superadmin");

  const path = "/superadmin/restaurants/" + encodeURIComponent(slug) + "/payment-settings";
  const legalName = value(fd, "legalName");
  const taxId = value(fd, "taxId");
  const providerName = value(fd, "providerName");
  const providerMerchantId = value(fd, "providerMerchantId");
  const paymentMode = value(fd, "paymentMode");
  const version = value(fd, "version");

  if (
    legalName === null || legalName.length > 200 ||
    taxId === null || (taxId !== "" && !/^[0-9]{10}$/.test(taxId)) ||
    providerName === null || providerName.length > 100 ||
    providerMerchantId === null || providerMerchantId.length > 150 ||
    Boolean(providerName) !== Boolean(providerMerchantId) ||
    (paymentMode !== "CASH_ONLY" && paymentMode !== "CASH_AND_CARD") ||
    version === null
  ) {
    redirect(path + "?error=validation");
  }

  const restaurant = await db.restaurant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!restaurant) redirect("/superadmin");

  const existing = await db.restaurantPaymentSettings.findUnique({
    where: { restaurantId: restaurant.id },
    select: {
      updatedAt: true,
      legalName: true,
      taxId: true,
      providerName: true,
      providerMerchantId: true,
      paymentMode: true,
      approvalStatus: true,
    },
  });

  // Forma köhnədirsə başqa yeniləməni səssizcə əvəz etmirik.
  if ((existing?.updatedAt.toISOString() ?? "new") !== version) {
    redirect(path + "?error=stale");
  }

  const data = {
    legalName: legalName || null,
    taxId: taxId || null,
    paymentMode: paymentMode as RestaurantPaymentMode,
    providerName: providerName || null,
    providerMerchantId: providerMerchantId || null,
    // Hüquqi məlumat və ya provayder dəyişəndə əvvəlki razılıq qüvvədə sayılmır.
    approvalStatus:
      existing && (
        existing.legalName !== (legalName || null) ||
        existing.taxId !== (taxId || null) ||
        existing.providerName !== (providerName || null) ||
        existing.providerMerchantId !== (providerMerchantId || null)
      )
        ? ("NOT_SUBMITTED" as const)
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
      // Eyni anda başqa sessiya yaratdısa, artıq mövcud olan qeydi əvəz etmə.
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        redirect(path + "?error=stale");
      }
      throw error;
    }
  }
  revalidatePath(path);
  redirect(path + "?saved=1");
}
