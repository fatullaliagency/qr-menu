/**
 * Keep client cart limits aligned with createCashOrder's server validation.
 * Server-side validation remains authoritative for submitted orders.
 */
export const MAX_CART_DISTINCT_ITEMS = 30;
export const MAX_QUANTITY_PER_ITEM = 30;

export type CartEntry<T extends { id: string }> = {
  item: T;
  quantity: number;
};

export function canAddCartItem<T extends { id: string }>(
  cart: ReadonlyArray<CartEntry<T>>,
  itemId: string
): boolean {
  const existing = cart.find((entry) => entry.item.id === itemId);
  if (existing) return existing.quantity < MAX_QUANTITY_PER_ITEM;
  return cart.length < MAX_CART_DISTINCT_ITEMS;
}

export function addCartItem<T extends { id: string }>(
  cart: CartEntry<T>[],
  item: T
): CartEntry<T>[] {
  if (!canAddCartItem(cart, item.id)) return cart;
  const existing = cart.find((entry) => entry.item.id === item.id);
  if (existing) {
    return cart.map((entry) =>
      entry.item.id === item.id
        ? { ...entry, quantity: entry.quantity + 1 }
        : entry
    );
  }
  return [...cart, { item, quantity: 1 }];
}
