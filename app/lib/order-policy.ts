import type { OrderStatus, PaymentMethod, PaymentStatus } from "@prisma/client";

/** Central order transition policy used by admin actions and tests. */
export const NEXT_STATUSES: Record<OrderStatus, readonly OrderStatus[]> = {
  NEW: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["ON_THE_WAY", "CANCELLED"],
  ON_THE_WAY: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

export function isOrderStatus(value: unknown): value is OrderStatus {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(NEXT_STATUSES, value)
  );
}

export function canTransitionOrder(current: unknown, next: unknown): boolean {
  return isOrderStatus(current) &&
    isOrderStatus(next) &&
    NEXT_STATUSES[current].includes(next);
}

// These conditions are used with id + session.restaurantId in the database
// updateMany WHERE, so stale/cross-tenant updates remain rejected.
export const CASH_PENDING_CONDITIONS = {
  status: "DELIVERED",
  paymentMethod: "CASH",
  paymentStatus: "PENDING",
} as const satisfies {
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
};

export function canConfirmCashPayment(order: {
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
}): boolean {
  return order.status === CASH_PENDING_CONDITIONS.status &&
    order.paymentMethod === CASH_PENDING_CONDITIONS.paymentMethod &&
    order.paymentStatus === CASH_PENDING_CONDITIONS.paymentStatus;
}
