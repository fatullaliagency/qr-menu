-- Additive, backward-compatible migration; existing orders remain DELIVERY.
CREATE TYPE "OrderFulfillmentType" AS ENUM ('DINE_IN', 'DELIVERY', 'PICKUP');
ALTER TABLE "Restaurant"
  ADD COLUMN "tableCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "dineInEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "deliveryEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "pickupEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order"
  ADD COLUMN "fulfillmentType" "OrderFulfillmentType" NOT NULL DEFAULT 'DELIVERY',
  ADD COLUMN "tableNumber" INTEGER;
CREATE INDEX "Order_restaurantId_fulfillmentType_createdAt_idx"
  ON "Order"("restaurantId", "fulfillmentType", "createdAt");
