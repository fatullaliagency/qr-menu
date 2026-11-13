import { createHash } from "node:crypto";
import type { HotelRoomStatus } from "@prisma/client";

/** Opaque folio grouping key; one room checkout yields a new stay key. */
export function hotelRoomStayKey(hotelId: string, roomId: string, roomNonce: string): string {
 if (!hotelId || !roomId || !roomNonce) throw new Error("Invalid room stay identity.");
 return createHash("sha256")
  .update("hotel-stay:v1:" + hotelId + ":" + roomId + ":" + roomNonce)
  .digest("hex").slice(0, 20);
}

/** Check-out or removal from active service must invalidate the bearer QR. */
export function shouldRotateHotelRoomToken(previous: HotelRoomStatus, next: HotelRoomStatus): boolean {
 return previous !== next && (previous === "OCCUPIED" || next === "VACANT");
}

/** No occupied room can be checked out while current-stay charges are pending. */
export function canReleaseHotelRoomWithCharges(
  previous: HotelRoomStatus, next: HotelRoomStatus, pendingCurrentStay: number
): boolean {
 if(!Number.isSafeInteger(pendingCurrentStay)||pendingCurrentStay<0) return false;
 return !(previous==="OCCUPIED"&&next==="VACANT"&&pendingCurrentStay>0);
}
