-- Dedicated internal room-charge ledger; no financial provider/PMS side effects.
-- Additive; no changes to Restaurant/Order/Category/MenuItem tables.
CREATE TYPE "HotelRoomChargeStatus" AS ENUM ('PENDING','APPROVED','VOID');
CREATE TABLE "HotelRoomCharge" (
 "id" TEXT PRIMARY KEY,
 "hotelId" TEXT NOT NULL,
 "roomId" TEXT NOT NULL,
 "orderId" TEXT NOT NULL UNIQUE,
 "amount" DECIMAL(10,2) NOT NULL,
 "status" "HotelRoomChargeStatus" NOT NULL DEFAULT 'PENDING',
 "approvedAt" TIMESTAMP(3),
 "approvedBy" VARCHAR(40),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "HotelRoomCharge_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "HotelRoomCharge_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "HotelRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "HotelRoomCharge_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "HotelOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "HotelRoomCharge_amount_nonnegative" CHECK ("amount" >= 0)
);
CREATE INDEX "HotelRoomCharge_hotelId_status_createdAt_idx" ON "HotelRoomCharge"("hotelId","status","createdAt");
CREATE INDEX "HotelRoomCharge_hotelId_roomId_status_idx" ON "HotelRoomCharge"("hotelId","roomId","status");
CREATE TABLE "HotelRoomChargeEvent" (
 "id" TEXT PRIMARY KEY,
 "hotelId" TEXT NOT NULL,
 "chargeId" TEXT NOT NULL,
 "fromStatus" "HotelRoomChargeStatus",
 "toStatus" "HotelRoomChargeStatus" NOT NULL,
 "actor" VARCHAR(40) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "HotelRoomChargeEvent_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "HotelRoomChargeEvent_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "HotelRoomCharge"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "HotelRoomChargeEvent_hotelId_chargeId_createdAt_idx" ON "HotelRoomChargeEvent"("hotelId","chargeId","createdAt");
