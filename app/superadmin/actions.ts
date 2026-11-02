"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import {
  clearSuperAdminSession,
  establishSuperAdminSession,
  isSuperAdminEnabled,
} from "@/app/lib/superadmin-auth";

export async function loginSuperAdmin(formData: FormData): Promise<void> {
  if (!isSuperAdminEnabled()) redirect("/superadmin");

  const entered = formData.get("accessKey");
  const configured = process.env.SUPERADMIN_ACCESS_KEY ?? "";

  if (
    typeof entered !== "string" ||
    entered.length < 32 ||
    entered.length > 256 ||
    configured.length < 32
  ) {
    redirect("/superadmin?error=1");
  }

  const enteredHash = createHash("sha256").update(entered, "utf8").digest();
  const configuredHash = createHash("sha256").update(configured, "utf8").digest();
  if (!timingSafeEqual(enteredHash, configuredHash)) {
    redirect("/superadmin?error=1");
  }

  await establishSuperAdminSession();
  redirect("/superadmin");
}

export async function logoutSuperAdmin(): Promise<void> {
  await clearSuperAdminSession();
  redirect("/superadmin");
}
