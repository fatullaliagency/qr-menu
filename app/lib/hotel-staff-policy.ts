import type { HotelDepartmentName } from "./hotel-validation.ts";

/** Never authorize access using a form/query department alone. */
export function normalizeHotelStaffUsername(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const username = input.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9._-]{2,39}$/.test(username) ? username : null;
}

export function canStaffAccessHotelDepartment(
  staffDepartment: HotelDepartmentName,
  requestedDepartment: HotelDepartmentName
): boolean {
  return staffDepartment === requestedDepartment;
}
