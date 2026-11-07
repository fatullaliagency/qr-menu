-- Add a separate, cascade-deleted binary store for short menu clips.
-- Existing menu items and photos are not changed.
CREATE TABLE "MenuItemVideo" (
  "menuItemId" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "mimeType" VARCHAR(20) NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "payload" BYTEA NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MenuItemVideo_pkey" PRIMARY KEY ("menuItemId")
);
CREATE INDEX "MenuItemVideo_restaurantId_idx" ON "MenuItemVideo"("restaurantId");
ALTER TABLE "MenuItemVideo" ADD CONSTRAINT "MenuItemVideo_menuItemId_fkey"
  FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
