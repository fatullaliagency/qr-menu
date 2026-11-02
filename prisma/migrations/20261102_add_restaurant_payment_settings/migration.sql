-- Staging database only: non-destructive addition for restaurant payment configuration.
-- This does not turn on card processing; no API keys or card data are stored.
-- Apply once to the staging database before the configuration screens are deployed.

DO $
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RestaurantPaymentMode') THEN
    CREATE TYPE "RestaurantPaymentMode" AS ENUM ('CASH_ONLY', 'CASH_AND_CARD');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MerchantApprovalStatus') THEN
    CREATE TYPE "MerchantApprovalStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED');
  END IF;
END $;

CREATE TABLE IF NOT EXISTS "RestaurantPaymentSettings" (
  "restaurantId" TEXT NOT NULL,
  "legalName" VARCHAR(200),
  "taxId" VARCHAR(10),
  "paymentMode" "RestaurantPaymentMode" NOT NULL DEFAULT 'CASH_ONLY',
  "providerName" VARCHAR(100),
  "providerMerchantId" VARCHAR(150),
  "approvalStatus" "MerchantApprovalStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RestaurantPaymentSettings_pkey" PRIMARY KEY ("restaurantId"),
  CONSTRAINT "RestaurantPaymentSettings_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RestaurantPaymentSettings_taxId_valid"
    CHECK ("taxId" IS NULL OR "taxId" ~ '^[0-9]{10}$')
);
