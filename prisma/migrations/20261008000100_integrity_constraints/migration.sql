-- Database-level integrity rules that Prisma's schema language cannot express.

-- Needed so a GiST exclusion constraint can combine text equality with a date range.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Two active bookings for the same property can never overlap, even under
-- concurrent requests. Ranges are half-open: a check-out day may be the next
-- guest's check-in day.
ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_no_overlap"
  EXCLUDE USING gist (
    "propertyId" WITH =,
    daterange("checkIn", "checkOut", '[)') WITH &&
  )
  WHERE ("status" IN ('PENDING', 'CONFIRMED', 'CANCELLATION_REQUESTED'));

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_dates_check" CHECK ("checkOut" > "checkIn"),
  ADD CONSTRAINT "Booking_nights_check" CHECK ("nights" = ("checkOut" - "checkIn")),
  ADD CONSTRAINT "Booking_guests_check" CHECK ("adults" >= 1 AND "children" >= 0),
  ADD CONSTRAINT "Booking_amounts_check" CHECK (
    "nightlyPriceCents" >= 0 AND "subtotalCents" >= 0 AND "cleaningFeeCents" >= 0
    AND "serviceFeeCents" >= 0 AND "commissionCents" >= 0 AND "ownerEarningsCents" >= 0
    AND "totalCents" = "subtotalCents" + "cleaningFeeCents" + "serviceFeeCents"
  );

ALTER TABLE "AvailabilityBlock"
  ADD CONSTRAINT "AvailabilityBlock_dates_check" CHECK ("endDate" > "startDate");

ALTER TABLE "Property"
  ADD CONSTRAINT "Property_price_check" CHECK ("nightlyPriceCents" > 0 AND "cleaningFeeCents" >= 0),
  ADD CONSTRAINT "Property_capacity_check" CHECK ("maxGuests" >= 1 AND "bedrooms" >= 0 AND "beds" >= 1 AND "bathrooms" >= 0),
  ADD CONSTRAINT "Property_nights_check" CHECK ("minNights" >= 1 AND "maxNights" >= "minNights");

ALTER TABLE "Review"
  ADD CONSTRAINT "Review_rating_check" CHECK ("rating" BETWEEN 1 AND 5);

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_amount_check" CHECK ("amountCents" >= 0),
  ADD CONSTRAINT "Payment_paid_at_check" CHECK ("status" <> 'PAID' OR "paidAt" IS NOT NULL);
