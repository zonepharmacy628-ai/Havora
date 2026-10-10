-- Property categories move from a fixed list in the code to a database table.
-- Additive only: no rows or columns are removed. The old "type" column is kept
-- (now optional) and every existing listing is linked to its matching category.

-- CreateEnum
CREATE TYPE "CategoryStatus" AS ENUM ('ACTIVE', 'PENDING', 'REJECTED');

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "categoryId" TEXT,
ALTER COLUMN "type" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "imagePublicId" TEXT,
    "status" "CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "rejectionReason" TEXT,
    "requestedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Category_status_name_idx" ON "Category"("status", "name");

-- CreateIndex
CREATE INDEX "Category_requestedById_idx" ON "Category"("requestedById");

-- CreateIndex
CREATE INDEX "Property_status_categoryId_idx" ON "Property"("status", "categoryId");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Category names are unique regardless of letter case ("Villa" = "villa").
CREATE UNIQUE INDEX "Category_name_lower_key" ON "Category"(lower("name"));

-- Carry the six categories that used to be a fixed list in the code over into
-- the new table, so every existing listing keeps its category.
INSERT INTO "Category" ("id", "name", "slug", "description", "imageUrl", "status", "updatedAt") VALUES
  ('cat_villa',       'Villa',       'villa',       'Private villas with space, privacy and often a pool.', 'https://images.unsplash.com/photo-1613977257363-707ba9348227', 'ACTIVE', CURRENT_TIMESTAMP),
  ('cat_apartment',   'Apartment',   'apartment',   'City and coastal apartments for short or long stays.', 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688', 'ACTIVE', CURRENT_TIMESTAMP),
  ('cat_hotel',       'Hotel',       'hotel',       'Hotel rooms and suites with on-site service.',         'https://images.unsplash.com/photo-1566073771259-6a8506099945', 'ACTIVE', CURRENT_TIMESTAMP),
  ('cat_beach_house', 'Beach house', 'beach-house', 'Homes by the sea, steps from the sand.',               'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2', 'ACTIVE', CURRENT_TIMESTAMP),
  ('cat_cabin',       'Cabin',       'cabin',       'Cabins and lodges in the mountains or by a lake.',     'https://images.unsplash.com/photo-1510798831971-661eb04b3739', 'ACTIVE', CURRENT_TIMESTAMP),
  ('cat_resort',      'Resort',      'resort',      'Resort stays with pools, dining and activities.',      'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4', 'ACTIVE', CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

-- Link every existing listing to the category matching its old fixed type.
UPDATE "Property" SET "categoryId" = CASE "type"
    WHEN 'VILLA'       THEN 'cat_villa'
    WHEN 'APARTMENT'   THEN 'cat_apartment'
    WHEN 'HOTEL'       THEN 'cat_hotel'
    WHEN 'BEACH_HOUSE' THEN 'cat_beach_house'
    WHEN 'CABIN'       THEN 'cat_cabin'
    WHEN 'RESORT'      THEN 'cat_resort'
  END
WHERE "categoryId" IS NULL AND "type" IS NOT NULL;
