import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { db } from "@/app/lib/db";
import { getHotelSecret } from "@/app/lib/hotel-auth";
import {hotelRuntimeSecureCookie} from "@/app/lib/hotel-cookie-policy";
import type { HotelDepartmentName } from "@/app/lib/hotel-validation";

const COOKIE = "qr_hotel_staff_session";
const TTL = 60 * 60 * 8;
type SignedStaff = {
  staffId: string; hotelId: string; department: HotelDepartmentName;
  version: string; expiresAt: number;
};
function signature(payload: string): Buffer {
  return createHmac("sha256", getHotelSecret())
    .update("hotel-staff-session:v1:" + payload).digest();
}
export async function createHotelStaffSession(staff: {
  id: string; hotelId: string; department: HotelDepartmentName; sessionVersion: string;
}): Promise<void> {
  const value: SignedStaff = {
    staffId: staff.id, hotelId: staff.hotelId, department: staff.department,
    version: staff.sessionVersion, expiresAt: Date.now() + TTL * 1000
  };
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  (await cookies()).set(COOKIE, payload + "." + signature(payload).toString("hex"), {
    httpOnly: true, sameSite: "lax", secure: hotelRuntimeSecureCookie(),
    path: "/hotel-admin", maxAge: TTL
  });
}
export async function getHotelStaffSession(): Promise<{
  staffId: string; hotelId: string; department: HotelDepartmentName;
} | null> {
  await connection();
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw || raw.length > 1200) return null;
  const parts = raw.split(".");
  if (parts.length !== 2 || !/^[0-9a-f]{64}$/.test(parts[1])) return null;
  if (!timingSafeEqual(signature(parts[0]), Buffer.from(parts[1], "hex"))) return null;
  let data: Partial<SignedStaff>;
  try { data = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")); }
  catch { return null; }
  if (!data || typeof data.staffId !== "string" || typeof data.hotelId !== "string" ||
      typeof data.version !== "string" || typeof data.expiresAt !== "number" ||
      data.expiresAt <= Date.now() || !["KITCHEN", "HOUSEKEEPING", "RECEPTION"].includes(String(data.department)))
    return null;
  // A disabled, reassigned or PIN-reset staff member loses access immediately.
  const staff = await db.hotelStaff.findFirst({
    where: {
      id: data.staffId, hotelId: data.hotelId, department: data.department,
      sessionVersion: data.version, active: true
    },
    select: { id: true, hotelId: true, department: true }
  });
  return staff ? { staffId: staff.id, hotelId: staff.hotelId, department: staff.department } : null;
}
export async function deleteHotelStaffSession(): Promise<void> {
  (await cookies()).set(COOKIE, "", {
    httpOnly: true, sameSite: "lax", secure: hotelRuntimeSecureCookie(),
    path: "/hotel-admin", maxAge: 0
  });
}
