-- Remove legacy Restaurant column defaults.
-- Existing row values are preserved.

ALTER TABLE public."Restaurant" ALTER COLUMN "address" DROP DEFAULT;
ALTER TABLE public."Restaurant" ALTER COLUMN "bgImageUrl" DROP DEFAULT;
ALTER TABLE public."Restaurant" ALTER COLUMN "description" DROP DEFAULT;
ALTER TABLE public."Restaurant" ALTER COLUMN "facebookUrl" DROP DEFAULT;
ALTER TABLE public."Restaurant" ALTER COLUMN "heroFoodUrl" DROP DEFAULT;
ALTER TABLE public."Restaurant" ALTER COLUMN "instagramUrl" DROP DEFAULT;
ALTER TABLE public."Restaurant" ALTER COLUMN "logoUrl" DROP DEFAULT;
ALTER TABLE public."Restaurant" ALTER COLUMN "mapUrl" DROP DEFAULT;
ALTER TABLE public."Restaurant" ALTER COLUMN "slogan" DROP DEFAULT;
ALTER TABLE public."Restaurant" ALTER COLUMN "subtitle" DROP DEFAULT;
ALTER TABLE public."Restaurant" ALTER COLUMN "wifiName" DROP DEFAULT;
ALTER TABLE public."Restaurant" ALTER COLUMN "wifiPassword" DROP DEFAULT;
ALTER TABLE public."Restaurant" ALTER COLUMN "workingHours" DROP DEFAULT;