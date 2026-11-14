-- Additive hotel-only audit trail. No existing room/order rows are changed.
CREATE TABLE "HotelRoomStatusEvent" (
 "id" TEXT NOT NULL,
 "hotelId" TEXT NOT NULL,
 "roomId" TEXT NOT NULL,
 "fromStatus" "HotelRoomStatus",
 "toStatus" "HotelRoomStatus" NOT NULL,
 "qrRotated" BOOLEAN NOT NULL DEFAULT false,
 "actor" VARCHAR(40) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "HotelRoomStatusEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "HotelRoomStatusEvent_hotelId_createdAt_idx" ON "HotelRoomStatusEvent"("hotelId","createdAt");
CREATE INDEX "HotelRoomStatusEvent_hotelId_roomId_createdAt_idx" ON "HotelRoomStatusEvent"("hotelId","roomId","createdAt");
ALTER TABLE "HotelRoomStatusEvent" ADD CONSTRAINT "HotelRoomStatusEvent_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HotelRoomStatusEvent" ADD CONSTRAINT "HotelRoomStatusEvent_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "HotelRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
