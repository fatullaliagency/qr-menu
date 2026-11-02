import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const PURPOSE = "qr-menu-order-tracking:v1:";

function secret(): string {
  const value = process.env.ADMIN_SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("Sifariş izləmə üçün server açarı konfiqurasiya olunmayıb.");
  }
  return value;
}

export function makeTrackingToken(orderId: string): string {
  return createHmac("sha256", secret())
    .update(PURPOSE + orderId)
    .digest("hex");
}

export function validTrackingToken(orderId: string, token: string): boolean {
  if (
    typeof orderId !== "string" ||
    orderId.length < 10 ||
    orderId.length > 150 ||
    !/^[a-f0-9]{64}$/.test(token)
  ) {
    return false;
  }
  const expected = Buffer.from(makeTrackingToken(orderId), "hex");
  const actual = Buffer.from(token, "hex");
  return timingSafeEqual(expected, actual);
}
