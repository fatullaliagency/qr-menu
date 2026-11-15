-- Additive hotel-only categories/departments. Existing data and RESTAURANT tables untouched.
ALTER TYPE "HotelServiceCategory" ADD VALUE IF NOT EXISTS 'TRANSFER';
ALTER TYPE "HotelServiceCategory" ADD VALUE IF NOT EXISTS 'SPA';
ALTER TYPE "HotelDepartment" ADD VALUE IF NOT EXISTS 'TRANSFER';
ALTER TYPE "HotelDepartment" ADD VALUE IF NOT EXISTS 'SPA';
ALTER TABLE "Hotel"
 ADD COLUMN "transferEnabled" BOOLEAN NOT NULL DEFAULT true,
 ADD COLUMN "spaEnabled" BOOLEAN NOT NULL DEFAULT true;
