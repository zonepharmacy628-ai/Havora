-- Guest bookings: bookings and reviews no longer require a user account.
-- Additive / relaxing only: no rows are deleted or rewritten, and existing
-- account-linked bookings and reviews keep their links.

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_authorId_fkey";

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "accessVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "idempotencyKey" TEXT,
ALTER COLUMN "customerId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "authorName" TEXT,
ALTER COLUMN "authorId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Booking_idempotencyKey_key" ON "Booking"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Booking_contactEmail_idx" ON "Booking"("contactEmail");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

