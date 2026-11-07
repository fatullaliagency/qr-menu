-- New dine-in orders may omit a phone; previous orders are preserved.
ALTER TABLE "Order" ALTER COLUMN "customerPhone" DROP NOT NULL;
