"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/app/lib/db";
import { hasSuperAdminSession } from "@/app/lib/superadmin-auth";

function field(fd: FormData, name: string): string | null {
  const raw = fd.get(name);
  return typeof raw === "string" ? raw.trim() : null;
}

function validText(value: string | null, maxLength: number): value is string {
  return value !== null &&
    value.length <= maxLength &&
    !/[\u0000-\u001f\u007f]/.test(value);
}

export async function updateSuperAdminRestaurant(formData: FormData): Promise<void> {
  // İcazə mütləq server action daxilində yoxlanır.
  if (!(await hasSuperAdminSession())) redirect("/superadmin");

  const slug = field(formData, "slug");
  if (!slug || !/^[a-z0-9][a-z0-9-]{1,158}[a-z0-9]$/.test(slug)) {
    redirect("/superadmin");
  }

  const url = "/superadmin/restaurants/" + encodeURIComponent(slug) + "/edit";
  const name = field(formData, "name");
  const phone = field(formData, "phone");
  const address = field(formData, "address");
  const workingHours = field(formData, "workingHours");

  if (
    !validText(name, 200) || name.length < 2 ||
    !validText(phone, 100) || phone.length < 3 ||
    !validText(address, 500) ||
    !validText(workingHours, 200)
  ) {
    redirect(url + "?error=validation");
  }

  // Yalnız seçilmiş restoranın bu dörd sahəsi dəyişir.
  // Slug, PIN, VÖEN, provayder və sifariş məlumatları dəyişmir.
  const updated = await db.restaurant.updateMany({
    where: { slug },
    data: {
      name,
      phone,
      address: address || null,
      workingHours: workingHours || null,
    },
  });

  if (updated.count !== 1) {
    redirect("/superadmin");
  }

  revalidatePath("/superadmin");
  revalidatePath(url);
  revalidatePath("/admin");
  revalidatePath("/" + slug);
  redirect(url + "?saved=1");
}
