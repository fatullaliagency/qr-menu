
-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM (
  'NEW',
  'CONFIRMED',
  'PREPARING',
  'ON_THE_WAY',
  'DELIVERED',
  'CANCELLED'
);

CREATE TYPE "PaymentMethod" AS ENUM (
  'CASH',
  'ONLINE_CARD',
  'MANUAL_TRANSFER'
);

CREATE TYPE "PaymentStatus" AS ENUM (
  'PENDING',
  'AWAITING_VERIFICATION',
  'PAID',
  'FAILED',
  'REFUNDED'
);

-- CreateTable
CREATE TABLE "Order" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "customerName" TEXT NOT NULL,
  "customerPhone" TEXT NOT NULL,
  "addressText" TEXT,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "customerNote" TEXT,
  "subtotal" DECIMAL(10,2) NOT NULL,
  "deliveryFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(10,2) NOT NULL,
  "status" "OrderStatus" NOT NULL DEFAULT 'NEW',
  "paymentMethod" "PaymentMethod" NOT NULL,
  "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "menuItemId" TEXT,
  "name" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" DECIMAL(10,2) NOT NULL,
  "lineTotal" DECIMAL(10,2) NOT NULL,

  CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Order_restaurantId_createdAt_idx"
ON "Order"("restaurantId", "createdAt");

CREATE INDEX "OrderItem_orderId_idx"
ON "OrderItem"("orderId");

-- AddForeignKey
ALTER TABLE "Order"
ADD CONSTRAINT "Order_restaurantId_fkey"
FOREIGN KEY ("restaurantId")
REFERENCES "Restaurant"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "OrderItem"
ADD CONSTRAINT "OrderItem_orderId_fkey"
FOREIGN KEY ("orderId")
REFERENCES "Order"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
