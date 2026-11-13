import type { HotelRequestStatus, HotelRoomChargeStatus } from "@prisma/client";

/** Approving a charge means ONLY internal folio approval, never money received. */
export function canApproveHotelRoomCharge(
  orderStatus: HotelRequestStatus,
  chargeStatus: HotelRoomChargeStatus
): boolean {
  return orderStatus === "COMPLETED" && chargeStatus === "PENDING";
}
export function canVoidHotelRoomCharge(chargeStatus: HotelRoomChargeStatus): boolean {
  return chargeStatus === "PENDING";
}
