"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/app/lib/db";
import { hasSuperAdminSession } from "@/app/lib/superadmin-auth";
import { hashRestaurantPin } from "@/app/lib/pin-security";
import { createWithRestaurantSlug } from "@/app/lib/restaurant-slug";

function field(form: FormData, name: string): string | null {
  const val = form.get(name);
  return typeof val === "string" ? val.trim() : null;
}

export async function createSuperAdminRestaurant(form: FormData): Promise<void> {
  if (!(await hasSuperAdminSession())) redirect("/superadmin");

  const name = field(form, "name");
  const phone = field(form, "phone");
  const pin = field(form, "pin");
  const legalName = field(form, "legalName");
  const taxId = field(form, "taxId");

  if (
    !name || name.length < 2 || name.length > 120 ||
    !phone || phone.length < 6 || phone.length > 30 ||
    !/^[+0-9() -]+$/.test(phone) ||
    !pin || !/^[0-9]{6,12}$/.test(pin) ||
    legalName === null || legalName.length > 200 ||
    taxId === null || (taxId.length > 0 && !/^[0-9]{10}$/.test(taxId))
  ) {
    redirect("/superadmin/restaurants/new?error=validation");
  }

  const pinHash = await hashRestaurantPin(pin);
  const slug = await createWithRestaurantSlug(name, async (generatedSlug) => {
    await db.restaurant.create({
      data: {
        name, slug: generatedSlug, phone, pinCode: pinHash,
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
  });

  revalidatePath("/superadmin");
  redirect("/superadmin/restaurants/new?created=" + encodeURIComponent(slug));
}
