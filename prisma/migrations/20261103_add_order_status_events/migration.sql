-- STAGING ONLY. Additive migration: no existing Order/Restaurant rows changed.
-- Preflight before apply: verify DB is qr-menu-orders-test (NOT production).
-- Do not backfill historical events with invented timestamps.
CREATE TABLE IF NOT EXISTS "OrderStatusEvent" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "fromStatus" "OrderStatus",
  "toStatus" "OrderStatus" NOT NULL,
  "actor" VARCHAR(16) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderStatusEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderStatusEvent_actor_check"
    CHECK ("actor" IN ('CUSTOMER', 'RESTAURANT')),
  CONSTRAINT "OrderStatusEvent_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrderStatusEvent_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "OrderStatusEvent_orderId_createdAt_idx"
  ON "OrderStatusEvent" ("orderId", "createdAt");
CREATE INDEX IF NOT EXISTS "OrderStatusEvent_restaurantId_createdAt_idx"
  ON "OrderStatusEvent" ("restaurantId", "createdAt");
