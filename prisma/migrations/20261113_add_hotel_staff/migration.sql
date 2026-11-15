-- Additive hotel staff isolation. Restaurant tables and hotel orders unchanged.
CREATE TABLE "HotelStaff" (
  "id" TEXT PRIMARY KEY,
  "hotelId" TEXT NOT NULL,
  "username" VARCHAR(40) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "pinCode" TEXT NOT NULL,
  "department" "HotelDepartment" NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sessionVersion" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HotelStaff_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "HotelStaff_hotelId_username_key" ON "HotelStaff"("hotelId","username");
CREATE INDEX "HotelStaff_hotelId_department_active_idx" ON "HotelStaff"("hotelId","department","active");
