import type { FulfillmentType } from "./fulfillment.ts";

export type DeliveryCoordinates = { latitude: number; longitude: number };

/** A map pin is optional for delivery. Never accept partial or forged coordinates. */
export function validateDeliveryCoordinates(
  type: FulfillmentType,
  latitude: unknown,
  longitude: unknown
): string | null {
  const hasLatitude = latitude !== null && latitude !== undefined;
  const hasLongitude = longitude !== null && longitude !== undefined;
  if (!hasLatitude && !hasLongitude) return null;
  if (type !== "DELIVERY") return "Məkan yalnız çatdırılma sifarişinə əlavə edilə bilər.";
  if (!hasLatitude || !hasLongitude ||
    typeof latitude !== "number" || !Number.isFinite(latitude) ||
    typeof longitude !== "number" || !Number.isFinite(longitude) ||
    latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return "Xəritədə düzgün məkan seçin.";
  }
  return null;
}

export function deliveryMapUrl(latitude: number | null, longitude: number | null): string | null {
  if (validateDeliveryCoordinates("DELIVERY", latitude, longitude) !== null ||
    latitude === null || longitude === null) return null;
  const pair = latitude.toFixed(6) + "," + longitude.toFixed(6);
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(pair);
}
