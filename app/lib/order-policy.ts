import type { OrderStatus, PaymentMethod, PaymentStatus } from "@prisma/client";
import { isFulfillmentType } from "./fulfillment.ts";

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

export type NoticeCode =
  | "confirmed" | "preparing" | "on-the-way" | "delivered" | "cancelled"
  | "cash-paid" | "stale" | "invalid";

const PAYMENT_METHODS = ["CASH", "ONLINE_CARD", "MANUAL_TRANSFER"] as const;
const PAYMENT_STATUSES = [
  "PENDING", "AWAITING_VERIFICATION", "PAID", "FAILED", "REFUNDED",
] as const;

/**
 * A server action may return only to the trusted admin orders path.
 * Values in the hidden returnTo field are untrusted and fully revalidated.
 * The date validator is passed in from the server to preserve Baku-date rules.
 */
export function buildOrderNoticeUrl(
  raw: unknown,
  notice: NoticeCode,
  validDateRange: (from: string, to: string) => boolean
): string {
  const params = new URLSearchParams();
  if (typeof raw === "string" && raw.length <= 1024) {
    try {
      const parsed = new URL(raw, "https://qr-menu-actions.invalid");
      if (
        parsed.origin === "https://qr-menu-actions.invalid" &&
        parsed.pathname === "/admin/orders"
      ) {
        const source = parsed.searchParams;
        const status = source.get("status");
        const method = source.get("method");
        const type = source.get("type");
        const payment = source.get("payment");
        const q = source.get("q");
        const page = source.get("page");
        const from = source.get("from");
        const to = source.get("to");
        if (isOrderStatus(status)) params.set("status", status);
        if (isFulfillmentType(type)) params.set("type", type);
        if (method && PAYMENT_METHODS.some((value) => value === method)) {
          params.set("method", method);
        }
        if (payment && PAYMENT_STATUSES.some((value) => value === payment)) {
          params.set("payment", payment);
        }
        if (q && /^[a-z0-9]{4,30}$/.test(q)) params.set("q", q);
        if (source.get("urgent") === "1") {
          params.set("urgent", "1");
          params.set("status", "NEW");
        }
        if (source.get("cashDue") === "1") {
          params.delete("urgent");
          params.set("cashDue", "1");
          params.set("status", "DELIVERED");
          params.set("method", "CASH");
          params.set("payment", "PENDING");
        }
        if (from !== null && to !== null && validDateRange(from, to)) {
          params.set("from", from);
          params.set("to", to);
        }
        if (page && /^[1-9][0-9]{0,3}$/.test(page)) {
          params.set("page", page);
        }
      }
    } catch {
      // Malformed URLs never influence the final admin-only redirect.
    }
  }
  params.set("notice", notice);
  return "/admin/orders?" + params.toString();
}
