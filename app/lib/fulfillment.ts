/** A single restaurant QR opens a menu with independent order destinations. */
export type FulfillmentType = "DINE_IN" | "DELIVERY" | "PICKUP";

export const FULFILLMENT_LABELS: Record<FulfillmentType, string> = {
  DINE_IN: "Restoranda",
  DELIVERY: "Çatdırılma",
  PICKUP: "Al-apar",
};

export function isFulfillmentType(value: unknown): value is FulfillmentType {
  return value === "DINE_IN" || value === "DELIVERY" || value === "PICKUP";
}

export function orderDestinationLabel(type: FulfillmentType, tableNumber: number | null): string {
  if (type === "DINE_IN") return tableNumber === null ? "Masa göstərilməyib" : "Masa " + tableNumber;
  return FULFILLMENT_LABELS[type];
}

/** Phone contact is optional only for table service; if supplied, it must be valid. */
export function isValidCustomerPhone(phone: string, type: FulfillmentType): boolean {
  if (phone === "" && type === "DINE_IN") return true;
  return /^[+0-9()\s-]{7,25}$/.test(phone) &&
    phone.replace(/\D/g, "").length >= 7 &&
    phone.replace(/\D/g, "").length <= 15;
}

export type FulfillmentSettings = {
  tableCount: number;
  dineInEnabled: boolean;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
};

export function validateOrderDestination(
  type: unknown,
  tableNumber: unknown,
  address: string,
  settings: FulfillmentSettings
): string | null {
  if (!isFulfillmentType(type)) return "Sifariş növü düzgün deyil.";
  if (type === "DINE_IN") {
    if (!settings.dineInEnabled || !Number.isInteger(settings.tableCount) || settings.tableCount < 1) {
      return "Bu restoranda masa sifarişi aktiv deyil.";
    }
    if (!Number.isInteger(tableNumber) || (tableNumber as number) < 1 ||
      (tableNumber as number) > settings.tableCount) {
      return "Düzgün masa nömrəsi seçin.";
    }
    if (address.trim()) return "Masa sifarişində çatdırılma ünvanı olmamalıdır.";
  } else if (type === "DELIVERY") {
    if (!settings.deliveryEnabled) return "Bu restoranda çatdırılma aktiv deyil.";
    if (tableNumber !== null && tableNumber !== undefined) {
      return "Çatdırılma sifarişində masa nömrəsi olmamalıdır.";
    }
    if (address.trim().length < 6 || address.trim().length > 300) {
      return "Çatdırılma ünvanını düzgün daxil edin.";
    }
  } else {
    if (!settings.pickupEnabled) return "Bu restoranda al-apar aktiv deyil.";
    if (tableNumber !== null && tableNumber !== undefined) {
      return "Al-apar sifarişində masa nömrəsi olmamalıdır.";
    }
    if (address.trim()) return "Al-apar sifarişində çatdırılma ünvanı olmamalıdır.";
  }
  return null;
}
