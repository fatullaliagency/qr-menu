/**
 * The latest order creation marker is independent from mutable order status.
 * The ordering matches Prisma's createdAt desc, id desc sort.
 */
export type OrderNotificationMarker = {
  id: string;
  createdAt: string;
};

export function isLaterOrderMarker(
  current: OrderNotificationMarker | null,
  previous: OrderNotificationMarker | null
): boolean {
  if (!current) return false;
  if (!previous) return true;
  if (current.createdAt !== previous.createdAt) {
    return current.createdAt > previous.createdAt;
  }
  return current.id > previous.id;
}

/** Never alert on initial loading; only later creation markers may alert. */
export function shouldNotifyOfOrder(
  current: OrderNotificationMarker | null,
  previous: OrderNotificationMarker | null,
  hasBaseline: boolean
): boolean {
  return hasBaseline && isLaterOrderMarker(current, previous);
}

/** Link directly to the alerted order even if it was already confirmed. */
export function orderAlertLink(orderId: unknown): string {
  if (typeof orderId !== "string") return "/admin/orders";
  const suffix = orderId.slice(-8).toLowerCase();
  return /^[a-z0-9]{4,8}$/.test(suffix)
    ? "/admin/orders?q=" + suffix
    : "/admin/orders";
}
