export const HOTEL_CATEGORIES = ["FOOD", "ROOM_SERVICE", "EXTRA"] as const;
export type HotelCategory = (typeof HOTEL_CATEGORIES)[number];
export const HOTEL_DEPARTMENTS = ["KITCHEN", "HOUSEKEEPING", "RECEPTION"] as const;
export type HotelDepartmentName = (typeof HOTEL_DEPARTMENTS)[number];
export const HOTEL_STATUSES = ["NEW", "ACCEPTED", "PREPARING", "DISPATCHED", "COMPLETED"] as const;
export type HotelStatusName = (typeof HOTEL_STATUSES)[number];
export type HotelCartLine = { serviceId: string; quantity: number };

export function hotelModuleEnabled(): boolean {
  return process.env.ENABLE_HOTEL_MODULE === "true";
}

export function isHotelCategory(value: unknown): value is HotelCategory {
  return HOTEL_CATEGORIES.includes(value as HotelCategory);
}
export function isHotelDepartment(value: unknown): value is HotelDepartmentName {
  return HOTEL_DEPARTMENTS.includes(value as HotelDepartmentName);
}
export function isHotelStatus(value: unknown): value is HotelStatusName {
  return HOTEL_STATUSES.includes(value as HotelStatusName);
}
export function hotelCategoryDepartment(category: HotelCategory): HotelDepartmentName {
  switch (category) {
    case "FOOD": return "KITCHEN";
    case "ROOM_SERVICE": return "HOUSEKEEPING";
    case "EXTRA": return "RECEPTION";
  }
}
export function hotelNextStatus(current: HotelStatusName): HotelStatusName | null {
  switch (current) {
    case "NEW": return "ACCEPTED";
    case "ACCEPTED": return "PREPARING";
    case "PREPARING": return "DISPATCHED";
    case "DISPATCHED": return "COMPLETED";
    case "COMPLETED": return null;
  }
}
export const hotelStatusLabels: Record<HotelStatusName, string> = {
  NEW:"Yeni", ACCEPTED:"Qəbul edildi", PREPARING:"Hazırlanır",
  DISPATCHED:"Göndərildi", COMPLETED:"Tamamlandı"
};
export const hotelDepartmentLabels: Record<HotelDepartmentName,string> = {
  KITCHEN:"Mətbəx / restoran", HOUSEKEEPING:"Otaq xidməti", RECEPTION:"Resepsiyon"
};
export const hotelCategoryLabels: Record<HotelCategory,string> = {
  FOOD:"Yemək və içki", ROOM_SERVICE:"Otaq xidməti", EXTRA:"Əlavə xidmətlər"
};
export function parseHotelCart(raw: unknown): HotelCartLine[] | null {
  if (typeof raw !== "string" || raw.length > 10000) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!Array.isArray(value) || value.length < 1 || value.length > 40) return null;
  const ids = new Set<string>();
  const result: HotelCartLine[] = [];
  for (const line of value) {
    if (!line || typeof line !== "object" || Array.isArray(line)) return null;
    const input = line as Record<string, unknown>;
    if (typeof input.serviceId !== "string" ||
        !/^[a-z0-9_-]{8,100}$/i.test(input.serviceId) ||
        !Number.isInteger(input.quantity) || (input.quantity as number) < 1 ||
        (input.quantity as number) > 20 || ids.has(input.serviceId)) return null;
    ids.add(input.serviceId);
    result.push({serviceId:input.serviceId, quantity:input.quantity as number});
  }
  return result;
}
export function validHotelRoomNumber(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9-]{1,20}$/.test(value);
}
