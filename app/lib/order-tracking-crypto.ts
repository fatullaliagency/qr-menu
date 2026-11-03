import { createHmac, timingSafeEqual } from "node:crypto";

// This module never reads an environment variable. Only the server-only
// wrapper may supply the actual signing secret.
const PURPOSE = "qr-menu-order-tracking:v1:";

export function isTrackingTokenFormatValid(orderId: unknown, token: unknown): boolean {
  return typeof orderId === "string" &&
    orderId.length >= 10 &&
    orderId.length <= 150 &&
    typeof token === "string" &&
    /^[a-f0-9]{64}$/.test(token);
}

export function createOrderTrackingToken(key: string, orderId: string): string {
  return createHmac("sha256", key)
    .update(PURPOSE + orderId)
    .digest("hex");
}

export function verifyOrderTrackingToken(
  key: string,
  orderId: unknown,
  token: unknown
): boolean {
  if (!isTrackingTokenFormatValid(orderId, token)) return false;
  // TypeScript cannot infer narrowing from a boolean formatting helper.
  const expected = Buffer.from(createOrderTrackingToken(key, orderId as string), "hex");
  const provided = Buffer.from(token as string, "hex");
  return timingSafeEqual(expected, provided);
}
