// Pure page policy shared by the kitchen screen and automated tests.
// Pages outside the current range are clamped to the last available page.
export const KITCHEN_PAGE_SIZE = 30;

export function getKitchenPage(raw: unknown, total: number) {
  const safeTotal = Number.isSafeInteger(total) && total >= 0 ? total : 0;
  const pageCount = Math.max(1, Math.ceil(safeTotal / KITCHEN_PAGE_SIZE));
  const requested =
    typeof raw === "string" && /^[1-9][0-9]{0,3}$/.test(raw)
      ? Number(raw)
      : 1;
  const page = Math.min(requested, pageCount);
  return {
    page,
    pageCount,
    skip: (page - 1) * KITCHEN_PAGE_SIZE,
    take: KITCHEN_PAGE_SIZE,
  };
}

export const KITCHEN_STATUSES = ["NEW", "CONFIRMED", "PREPARING"] as const;
export type KitchenStatus = (typeof KITCHEN_STATUSES)[number];

export function parseKitchenStatus(raw: unknown): KitchenStatus | null {
  if (typeof raw !== "string") return null;
  return KITCHEN_STATUSES.some((status) => status === raw)
    ? raw as KitchenStatus
    : null;
}

export function kitchenPageUrl(status: KitchenStatus | null, page: number): string {
  const params = new URLSearchParams();
  if (status && parseKitchenStatus(status)) params.set("status", status);
  if (Number.isSafeInteger(page) && page > 0) params.set("page", String(page));
  return "/admin/orders/kitchen" + (params.size ? "?" + params.toString() : "");
}
