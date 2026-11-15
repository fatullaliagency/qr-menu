-- Additive; "legacy" explicitly marks any older charges requiring reconciliation.
ALTER TABLE "HotelRoomCharge" ADD COLUMN "stayKey" VARCHAR(20) NOT NULL DEFAULT 'legacy';
CREATE INDEX "HotelRoomCharge_hotelId_roomId_stayKey_idx" ON "HotelRoomCharge"("hotelId","roomId","stayKey");
