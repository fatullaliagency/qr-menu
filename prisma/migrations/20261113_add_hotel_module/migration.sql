-- Additive hotel-only migration. No Restaurant/Order/Category/MenuItem changes.
CREATE TYPE "HotelRoomStatus" AS ENUM ('VACANT','OCCUPIED','OUT_OF_SERVICE');
CREATE TYPE "HotelServiceCategory" AS ENUM ('FOOD','ROOM_SERVICE','EXTRA');
CREATE TYPE "HotelDepartment" AS ENUM ('KITCHEN','HOUSEKEEPING','RECEPTION');
CREATE TYPE "HotelRequestStatus" AS ENUM ('NEW','ACCEPTED','PREPARING','DISPATCHED','COMPLETED');

CREATE TABLE "Hotel" (
 "id" TEXT PRIMARY KEY, "name" VARCHAR(120) NOT NULL,
 "slug" VARCHAR(60) NOT NULL UNIQUE, "branchName" VARCHAR(120),
 "phone" VARCHAR(30) NOT NULL, "email" VARCHAR(200),
 "address" VARCHAR(300), "roomCount" INTEGER NOT NULL DEFAULT 0,
 "pinCode" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "HotelRoom" (
 "id" TEXT PRIMARY KEY, "hotelId" TEXT NOT NULL,
 "number" VARCHAR(20) NOT NULL, "status" "HotelRoomStatus" NOT NULL DEFAULT 'VACANT',
 "qrNonce" TEXT NOT NULL UNIQUE, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "HotelRoom_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "HotelRoom_hotelId_number_key" ON "HotelRoom"("hotelId","number");
CREATE INDEX "HotelRoom_hotelId_status_idx" ON "HotelRoom"("hotelId","status");

CREATE TABLE "HotelService" (
 "id" TEXT PRIMARY KEY, "hotelId" TEXT NOT NULL,
 "name" VARCHAR(120) NOT NULL, "description" VARCHAR(500),
 "category" "HotelServiceCategory" NOT NULL, "department" "HotelDepartment" NOT NULL,
 "price" DECIMAL(10,2) NOT NULL DEFAULT 0, "active" BOOLEAN NOT NULL DEFAULT true,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "HotelService_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "HotelService_hotelId_category_active_idx" ON "HotelService"("hotelId","category","active");
CREATE INDEX "HotelService_hotelId_department_active_idx" ON "HotelService"("hotelId","department","active");

CREATE TABLE "HotelGuestRequest" (
 "id" TEXT PRIMARY KEY, "hotelId" TEXT NOT NULL, "roomId" TEXT NOT NULL,
 "trackingTokenHash" VARCHAR(64) NOT NULL, "clientRequestId" VARCHAR(36) NOT NULL UNIQUE,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "HotelGuestRequest_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "HotelGuestRequest_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "HotelRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "HotelGuestRequest_hotelId_createdAt_idx" ON "HotelGuestRequest"("hotelId","createdAt");
CREATE INDEX "HotelGuestRequest_hotelId_roomId_createdAt_idx" ON "HotelGuestRequest"("hotelId","roomId","createdAt");

CREATE TABLE "HotelOrder" (
 "id" TEXT PRIMARY KEY, "hotelId" TEXT NOT NULL, "requestId" TEXT NOT NULL,
 "department" "HotelDepartment" NOT NULL, "status" "HotelRequestStatus" NOT NULL DEFAULT 'NEW',
 "note" VARCHAR(500), "total" DECIMAL(10,2) NOT NULL,
 "roomCharge" BOOLEAN NOT NULL DEFAULT true,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "HotelOrder_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "HotelOrder_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "HotelGuestRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "HotelOrder_hotelId_department_status_createdAt_idx" ON "HotelOrder"("hotelId","department","status","createdAt");
CREATE INDEX "HotelOrder_hotelId_createdAt_idx" ON "HotelOrder"("hotelId","createdAt");

CREATE TABLE "HotelOrderItem" (
 "id" TEXT PRIMARY KEY, "orderId" TEXT NOT NULL,
 "serviceId" TEXT NOT NULL, "name" VARCHAR(120) NOT NULL,
 "quantity" INTEGER NOT NULL, "unitPrice" DECIMAL(10,2) NOT NULL,
 "lineTotal" DECIMAL(10,2) NOT NULL,
 CONSTRAINT "HotelOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "HotelOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "HotelOrderItem_orderId_idx" ON "HotelOrderItem"("orderId");

CREATE TABLE "HotelOrderEvent" (
 "id" TEXT PRIMARY KEY, "hotelId" TEXT NOT NULL, "orderId" TEXT NOT NULL,
 "fromStatus" "HotelRequestStatus", "toStatus" "HotelRequestStatus" NOT NULL,
 "actor" VARCHAR(40) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "HotelOrderEvent_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "HotelOrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "HotelOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "HotelOrderEvent_hotelId_orderId_createdAt_idx" ON "HotelOrderEvent"("hotelId","orderId","createdAt");
