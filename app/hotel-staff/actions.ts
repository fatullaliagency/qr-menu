"use server";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/app/lib/db";
import { verifyRestaurantPin } from "@/app/lib/pin-security";
import { getHotelSecret, deleteHotelSession } from "@/app/lib/hotel-auth";
import { createHotelStaffSession, deleteHotelStaffSession } from "@/app/lib/hotel-staff-auth";
import { normalizeHotelStaffUsername } from "@/app/lib/hotel-staff-policy";
import { hotelModuleEnabled } from "@/app/lib/hotel-validation";

export async function loginHotelStaff(form: FormData): Promise<void> {
  if (!hotelModuleEnabled()) redirect("/hotel-staff?error=unavailable");
  const slug = String(form.get("slug") ?? "").trim();
  const username = normalizeHotelStaffUsername(form.get("username"));
  const pin = String(form.get("pin") ?? "");
  if (!/^[a-z0-9-]{3,60}$/.test(slug) || !username || !/^[0-9]{6,12}$/.test(pin))
    redirect("/hotel-staff?error=login");

  const ipValue = (await headers()).get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const ip = isIP(ipValue) ? ipValue : process.env.NODE_ENV !== "production" ? "local-development" : null;
  if (!ip) redirect("/hotel-staff?error=unavailable");
  const key = createHmac("sha256", getHotelSecret())
    .update("hotel-staff-login:v1:" + slug + ":" + username + ":" + ip).digest("hex");
  const hotel = await db.hotel.findUnique({ where: { slug }, select: { id: true } });
  const staff = hotel ? await db.hotelStaff.findFirst({
    where: { hotelId: hotel.id, username, active: true },
    select: { id: true, hotelId: true, department: true, sessionVersion: true, pinCode: true }
  }) : null;
  const valid = Boolean(staff && await verifyRestaurantPin(pin, staff.pinCode));
  const result = await db.$transaction(async tx => {
    await tx.$executeRaw`INSERT INTO public."AdminLoginAttempt" ("key","failedAttempts","blockedUntil","updatedAt") VALUES (${key},0,NULL,CURRENT_TIMESTAMP) ON CONFLICT ("key") DO NOTHING`;
    const records = await tx.$queryRaw<{ failedAttempts: number; blockedUntil: Date | null; updatedAt: Date }[]>`SELECT "failedAttempts","blockedUntil","updatedAt" FROM public."AdminLoginAttempt" WHERE "key"=${key} FOR UPDATE`;
    const row = records[0]; if (!row) return "invalid";
    const now = new Date();
    if (row.blockedUntil && row.blockedUntil > now) return "blocked";
    if (valid) {
      await tx.adminLoginAttempt.update({ where: { key }, data: { failedAttempts: 0, blockedUntil: null } });
      return "success";
    }
    const count = row.blockedUntil || now.getTime() - row.updatedAt.getTime() > 15 * 60 * 1000
      ? 1 : row.failedAttempts + 1;
    await tx.adminLoginAttempt.update({ where: { key }, data: {
      failedAttempts: count, blockedUntil: count >= 5 ? new Date(now.getTime() + 15 * 60 * 1000) : null
    } });
    return count >= 5 ? "blocked" : "invalid";
  });
  if (result !== "success" || !staff)
    redirect("/hotel-staff?error=" + (result === "blocked" ? "blocked" : "login"));
  // Prevent stale manager credentials from elevating the employee on shared devices.
  await deleteHotelSession();
  await createHotelStaffSession(staff);
  redirect("/hotel-admin/panel/" + staff.department.toLowerCase());
}
export async function logoutHotelStaff(): Promise<void> {
  await deleteHotelStaffSession();
  redirect("/hotel-staff");
}
