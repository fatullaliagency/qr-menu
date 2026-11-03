import "server-only";

import {
  createOrderTrackingToken,
  verifyOrderTrackingToken,
  isTrackingTokenFormatValid,
} from "@/app/lib/order-tracking-crypto";

function secret(): string {
  const value = process.env.ADMIN_SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("Sifariş izləmə üçün server açarı konfiqurasiya olunmayıb.");
  }
  return value;
}

export function makeTrackingToken(orderId: string): string {
  return createOrderTrackingToken(secret(), orderId);
}

export function validTrackingToken(orderId: string, token: string): boolean {
  // Invalid links fail before accessing the server secret or querying the DB.
  if (!isTrackingTokenFormatValid(orderId, token)) return false;
  return verifyOrderTrackingToken(secret(), orderId, token);
}
