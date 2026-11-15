-- Optional international guest-facing translations. Existing hotel services remain valid.
ALTER TABLE public."HotelService"
 ADD COLUMN IF NOT EXISTS "nameEn" VARCHAR(120),
 ADD COLUMN IF NOT EXISTS "nameRu" VARCHAR(120),
 ADD COLUMN IF NOT EXISTS "descriptionEn" VARCHAR(500),
 ADD COLUMN IF NOT EXISTS "descriptionRu" VARCHAR(500);
