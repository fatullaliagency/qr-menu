import type { HotelCartLine } from "./hotel-validation.ts";

export type StoredHotelRequestDraft = {
  hotelId: string;
  roomId: string;
  orders: {
    note: string | null;
    items: { serviceId: string; quantity: number }[];
  }[];
};
export function isHotelRequestUUIDv4(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
}
/** A retry must match the original room, note and EVERY service/quantity. */
export function isMatchingHotelRequest(
  existing: StoredHotelRequestDraft,
  hotelId: string,
  roomId: string,
  note: string,
  lines: HotelCartLine[]
): boolean {
  if(existing.hotelId !== hotelId || existing.roomId !== roomId) return false;
  if(existing.orders.length < 1 || existing.orders.some(order => (order.note ?? "") !== note)) return false;
  const original = existing.orders.flatMap(order => order.items);
  if(original.length !== lines.length) return false;
  const map = new Map(original.map(item => [item.serviceId, item.quantity]));
  if(map.size !== original.length) return false;
  return lines.every(line => map.get(line.serviceId) === line.quantity);
}
