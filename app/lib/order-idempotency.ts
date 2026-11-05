/**
 * Database-backed idempotency without a schema migration:
 * the browser's UUID v4 is stored as Order.id, an existing unique primary key.
 * Never use a browser-supplied key without validating its shape and matching
 * the original order's restaurant and customer/cart data on replay.
 */
export type CashOrderDraft = {
  slug: string;
  customerName: string;
  customerPhone: string;
  addressText: string;
  customerNote: string;
  items: { itemId: string; quantity: number }[];
};

export type StoredCashOrder = {
  restaurantId: string;
  customerName: string;
  customerPhone: string;
  addressText: string | null;
  customerNote: string | null;
  items: { menuItemId: string | null; quantity: number }[];
};

export function isValidOrderAttemptId(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
}

export function canonicalCashOrderDraft(draft: CashOrderDraft): string {
  return JSON.stringify({
    slug: draft.slug.trim(),
    customerName: draft.customerName.trim(),
    customerPhone: draft.customerPhone.trim(),
    addressText: draft.addressText.trim(),
    customerNote: draft.customerNote.trim(),
    items: [...draft.items]
      .map(({ itemId, quantity }) => ({ itemId, quantity }))
      .sort((a, b) => a.itemId.localeCompare(b.itemId, "en")),
  });
}

export function isMatchingCashOrder(
  existing: StoredCashOrder,
  restaurantId: string,
  draft: CashOrderDraft
): boolean {
  if (
    existing.restaurantId !== restaurantId ||
    existing.customerName !== draft.customerName.trim() ||
    existing.customerPhone !== draft.customerPhone.trim() ||
    existing.addressText !== draft.addressText.trim() ||
    (existing.customerNote ?? "") !== draft.customerNote.trim() ||
    existing.items.length !== draft.items.length
  ) return false;

  // Match by item identity and quantity, not by mutable menu prices or
  // order status. Retries must recover even if staff already confirmed it.
  const items = new Map(existing.items.map((item) => [item.menuItemId, item.quantity]));
  if (items.size !== existing.items.length) return false;
  return draft.items.every((item) => items.get(item.itemId) === item.quantity);
}
