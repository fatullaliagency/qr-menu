"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/app/lib/db";
import { hasSuperAdminSession } from "@/app/lib/superadmin-auth";
import { hashRestaurantPin } from "@/app/lib/pin-security";

const RESERVED = new Set([
  "admin", "superadmin", "api", "order", "login", "logout",
  "404", "500", "_next", "favicon", "robots", "sitemap",
  "manifest", "static", "restaurants", "restaurant", "new",
]);

function field(form: FormData, name: string): string | null {
  const val = form.get(name);
  return typeof val === "string" ? val.trim() : null;
}

export async function createSuperAdminRestaurant(form: FormData): Promise<void> {
  if (!(await hasSuperAdminSession())) redirect("/superadmin");

  const name = field(form, "name");
  const slug = field(form, "slug")?.toLowerCase();
  const phone = field(form, "phone");
  const pin = field(form, "pin");
  const legalName = field(form, "legalName");
  const taxId = field(form, "taxId");

  if (
    !name || name.length < 2 || name.length > 120 ||
    !slug || !/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug) ||
    RESERVED.has(slug) ||
    !phone || phone.length < 6 || phone.length > 30 ||
    !/^[+0-9() -]+$/.test(phone) ||
    !pin || !/^[0-9]{6,12}$/.test(pin) ||
    legalName === null || legalName.length > 200 ||
    taxId === null || (taxId.length > 0 && !/^[0-9]{10}$/.test(taxId))
  ) {
    redirect("/superadmin/restaurants/new?error=validation");
  }

  const pinHash = await hashRestaurantPin(pin);
  try {
    await db.restaurant.create({
      data: {
        name, slug, phone, pinCode: pinHash,
        paymentSettings: {
          create: {
            legalName: legalName || null,
            taxId: taxId || null,
            paymentMode: "CASH_ONLY",
            approvalStatus: "NOT_SUBMITTED",
          },
        },
      },
    });
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null &&
        "code" in error && error.code === "P2002") {
      redirect("/superadmin/restaurants/new?error=duplicate");
    }
    throw error;
  }

  revalidatePath("/superadmin");
  redirect("/superadmin/restaurants/new?created=" + encodeURIComponent(slug));
}
