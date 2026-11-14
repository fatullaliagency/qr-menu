import { createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function hotelRoomToken(secret: string, hotelId: string, roomId: string, nonce: string): string {
  if (secret.length < 32 || !hotelId || !roomId || !nonce) throw new Error("Hotel QR secret missing.");
  return createHmac("sha256", secret).update("hotel-room:v1:" + hotelId + ":" + roomId + ":" + nonce).digest("hex");
}
export function verifyHotelRoomToken(secret: string, hotelId: string, roomId: string, nonce: string, token: unknown): boolean {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) return false;
  const expected = Buffer.from(hotelRoomToken(secret,hotelId,roomId,nonce), "hex");
  return timingSafeEqual(expected, Buffer.from(token, "hex"));
}
export function generateHotelTrackingToken(): string {
  return randomBytes(24).toString("base64url");
}
export function hashHotelTrackingToken(token: string): string {
  return createHash("sha256").update("hotel-tracking:v1:" + token).digest("hex");
}
export function verifyHotelTrackingToken(token: unknown, hash: string): boolean {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{32,43}$/.test(token) ||
      !/^[a-f0-9]{64}$/.test(hash)) return false;
  return timingSafeEqual(Buffer.from(hashHotelTrackingToken(token), "hex"),Buffer.from(hash,"hex"));
}

export function hotelTrackingTokenFromRequest(secret: string, requestId: string): string {
  if (secret.length < 32 || !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(requestId)) {
    throw new Error("Invalid tracking request.");
  }
  return createHmac("sha256",secret).update("hotel-tracking-request:v1:" + requestId).digest("base64url");
}
