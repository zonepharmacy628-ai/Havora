import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BookingError, createBooking, findConflict, generateBookingReference, transitionBooking, type CreateBookingInput } from "@/lib/bookings";
import { addDays, parseDate, todayIn } from "@/lib/dates";
import { TEST_DATABASE_URL } from "./global-setup";

// Runs against a real PostgreSQL engine (in-memory PGlite) with the production migrations applied.
const prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });

const today = todayIn("UTC");
const day = (offset: number) => addDays(today, offset);

let ownerId: string;
let customerId: string;
let otherCustomerId: string;
let propertyId: string;
let requestPropertyId: string;

/**
 * The in-memory test database (PGlite behind a socket) drops the connection
 * after it reports a constraint violation. Real PostgreSQL keeps it open; here
 * we simply reconnect before the next query.
 */
async function reconnect() {
  await prisma.$disconnect();
  await prisma.$connect();
}

function stay(overrides: Partial<CreateBookingInput> = {}): CreateBookingInput {
  return {
    propertyId,
    customerId,
    checkIn: day(30),
    checkOut: day(35),
    adults: 2,
    children: 0,
    paymentMethod: "PAY_AT_PROPERTY",
    contactName: "Test Guest",
    contactEmail: "guest@example.test",
    contactPhone: "+1 555 010 0100",
    ...overrides,
  };
}

beforeAll(async () => {
  const user = (email: string, role: "OWNER" | "CUSTOMER") => prisma.user.create({ data: { email, name: email.split("@")[0], role } });
  ownerId = (await user("owner@example.test", "OWNER")).id;
  customerId = (await user("customer@example.test", "CUSTOMER")).id;
  otherCustomerId = (await user("other@example.test", "CUSTOMER")).id;

  await prisma.platformSetting.createMany({
    data: [
      { key: "commission_rate_bps", value: "1200" },
      { key: "service_fee_rate_bps", value: "500" },
    ],
  });

  const base = {
    ownerId,
    summary: "Test listing",
    description: "Test listing description",
    type: "VILLA" as const,
    status: "PUBLISHED" as const,
    addressLine: "1 Test Street",
    city: "Testville",
    country: "Testland",
    countryCode: "TL",
    timezone: "UTC",
    nightlyPriceCents: 20_000,
    cleaningFeeCents: 5_000,
    maxGuests: 4,
    bedrooms: 2,
    beds: 2,
    bathrooms: 1,
    minNights: 2,
    maxNights: 14,
  };
  propertyId = (await prisma.property.create({ data: { ...base, slug: "instant", title: "Instant villa", instantBook: true } })).id;
  requestPropertyId = (await prisma.property.create({ data: { ...base, slug: "request", title: "Request villa", instantBook: false } })).id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("createBooking", () => {
  it("creates a confirmed booking with a server-calculated price and an UNPAID payment", async () => {
    const booking = await createBooking(prisma, stay());
    expect(booking.reference).toMatch(/^HV-[A-Z2-9]{8}$/);
    expect(booking.status).toBe("CONFIRMED");
    expect(booking.nights).toBe(5);
    expect(booking.subtotalCents).toBe(100_000);
    expect(booking.serviceFeeCents).toBe(5_000);
    expect(booking.totalCents).toBe(110_000);
    expect(booking.commissionCents).toBe(12_000);
    expect(booking.ownerEarningsCents).toBe(93_000);

    const payments = await prisma.payment.findMany({ where: { bookingId: booking.id } });
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({ method: "PAY_AT_PROPERTY", status: "UNPAID", amountCents: 110_000, paidAt: null });

    const guests = await prisma.bookingGuest.findMany({ where: { bookingId: booking.id } });
    expect(guests).toHaveLength(1);
    expect(await prisma.auditLog.count({ where: { entityId: booking.id, action: "booking.created" } })).toBe(1);
  });

  it("rejects overlapping dates for the same property", async () => {
    await expect(createBooking(prisma, stay({ customerId: otherCustomerId }))).rejects.toThrow(BookingError);
    await expect(createBooking(prisma, stay({ customerId: otherCustomerId, checkIn: day(33), checkOut: day(38) }))).rejects.toThrow(/no longer available/);
    await expect(createBooking(prisma, stay({ customerId: otherCustomerId, checkIn: day(28), checkOut: day(31) }))).rejects.toThrow(/no longer available/);
  });

  it("allows a back-to-back booking that starts on the previous check-out day", async () => {
    const booking = await createBooking(prisma, stay({ customerId: otherCustomerId, checkIn: day(35), checkOut: day(38) }));
    expect(booking.status).toBe("CONFIRMED");
  });

  it("lets only one of two simultaneous requests for the same dates succeed", async () => {
    const attempts = await Promise.allSettled([
      createBooking(prisma, stay({ checkIn: day(60), checkOut: day(63) })),
      createBooking(prisma, stay({ customerId: otherCustomerId, checkIn: day(60), checkOut: day(63) })),
    ]);
    expect(attempts.filter((a) => a.status === "fulfilled")).toHaveLength(1);
    const rejected = attempts.find((a) => a.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(BookingError);
    expect(await prisma.booking.count({ where: { propertyId, checkIn: parseDate(day(60)) } })).toBe(1);
  });

  it("is protected by a database exclusion constraint even if application checks are bypassed", async () => {
    const raw = {
      reference: generateBookingReference(),
      propertyId,
      customerId: otherCustomerId,
      checkIn: parseDate(day(31)),
      checkOut: parseDate(day(33)),
      nights: 2,
      adults: 1,
      status: "CONFIRMED" as const,
      currency: "USD",
      nightlyPriceCents: 20_000,
      subtotalCents: 40_000,
      cleaningFeeCents: 5_000,
      serviceFeeCents: 2_000,
      totalCents: 47_000,
      commissionRateBps: 1200,
      commissionCents: 4_800,
      ownerEarningsCents: 40_200,
      contactName: "Bypass",
      contactEmail: "bypass@example.test",
      contactPhone: "+1 555 010 0199",
      cancellationPolicy: "MODERATE" as const,
    };
    const overlapping = { propertyId, status: { in: ["PENDING", "CONFIRMED", "CANCELLATION_REQUESTED"] as const }, checkIn: { lt: raw.checkOut }, checkOut: { gt: raw.checkIn } };
    const before = await prisma.booking.count({ where: { ...overlapping, status: { in: [...overlapping.status.in] } } });

    // Written straight to the table, skipping createBooking() entirely — PostgreSQL itself must refuse it.
    await expect(prisma.booking.create({ data: raw })).rejects.toThrow();
    await reconnect();
    expect(await prisma.booking.count({ where: { ...overlapping, status: { in: [...overlapping.status.in] } } })).toBe(before);

    // The identical row is accepted when it is not an active booking, proving the
    // rejection above came from the overlap rule and nothing else.
    await expect(prisma.booking.create({ data: { ...raw, status: "CANCELLED" } })).resolves.toBeTruthy();
  });

  it("rejects totals that do not add up at the database level", async () => {
    await expect(
      prisma.booking.create({
        data: {
          reference: generateBookingReference(),
          propertyId,
          customerId,
          checkIn: parseDate(day(200)),
          checkOut: parseDate(day(202)),
          nights: 2,
          adults: 1,
          currency: "USD",
          nightlyPriceCents: 20_000,
          subtotalCents: 40_000,
          cleaningFeeCents: 5_000,
          serviceFeeCents: 2_000,
          totalCents: 1,
          commissionRateBps: 1200,
          commissionCents: 4_800,
          ownerEarningsCents: 40_200,
          contactName: "Tamper",
          contactEmail: "tamper@example.test",
          contactPhone: "+1 555 010 0198",
          cancellationPolicy: "MODERATE",
        },
      }),
    ).rejects.toThrow();
    await reconnect();
  });

  it("validates dates, capacity and stay length on the server", async () => {
    await expect(createBooking(prisma, stay({ checkIn: day(-2), checkOut: day(2) }))).rejects.toThrow(/past/);
    await expect(createBooking(prisma, stay({ checkIn: day(100), checkOut: day(101) }))).rejects.toThrow(/minimum stay/);
    await expect(createBooking(prisma, stay({ checkIn: day(100), checkOut: day(130) }))).rejects.toThrow(/up to 14 nights/);
    await expect(createBooking(prisma, stay({ checkIn: day(100), checkOut: day(103), adults: 4, children: 1 }))).rejects.toThrow(/maximum of 4 guests/);
  });

  it("refuses online payment — no simulated gateway exists", async () => {
    await expect(createBooking(prisma, stay({ checkIn: day(100), checkOut: day(103), paymentMethod: "ONLINE" }))).rejects.toThrow(/not available yet/);
    expect(await prisma.payment.count({ where: { method: "ONLINE" } })).toBe(0);
  });

  it("refuses unpublished listings, owner-blocked dates and self-booking", async () => {
    await prisma.property.update({ where: { id: requestPropertyId }, data: { status: "UNLISTED" } });
    await expect(createBooking(prisma, stay({ propertyId: requestPropertyId }))).rejects.toThrow(/not available for booking/);
    await prisma.property.update({ where: { id: requestPropertyId }, data: { status: "PUBLISHED" } });

    await prisma.availabilityBlock.create({ data: { propertyId: requestPropertyId, startDate: parseDate(day(40)), endDate: parseDate(day(45)) } });
    expect(await findConflict(prisma, requestPropertyId, day(42), day(44))).toBe("blocked");
    await expect(createBooking(prisma, stay({ propertyId: requestPropertyId, checkIn: day(42), checkOut: day(44) }))).rejects.toThrow(/no longer available/);

    await expect(createBooking(prisma, stay({ customerId: ownerId, checkIn: day(100), checkOut: day(103) }))).rejects.toThrow(/own property/);
  });

  it("refuses bookings for a suspended owner's listings", async () => {
    await prisma.user.update({ where: { id: ownerId }, data: { status: "SUSPENDED" } });
    await expect(createBooking(prisma, stay({ checkIn: day(100), checkOut: day(103) }))).rejects.toThrow(/not available for booking/);
    await prisma.user.update({ where: { id: ownerId }, data: { status: "ACTIVE" } });
  });
});

describe("booking lifecycle", () => {
  it("creates a PENDING request for non-instant listings and enforces who may confirm it", async () => {
    const booking = await createBooking(prisma, stay({ propertyId: requestPropertyId, checkIn: day(70), checkOut: day(73) }));
    expect(booking.status).toBe("PENDING");

    await expect(transitionBooking(prisma, { bookingId: booking.id, to: "CONFIRMED", actor: "CUSTOMER", actorId: customerId })).rejects.toThrow(BookingError);
    const confirmed = await transitionBooking(prisma, { bookingId: booking.id, to: "CONFIRMED", actor: "OWNER", actorId: ownerId });
    expect(confirmed.status).toBe("CONFIRMED");
  });

  it("frees the dates and voids the unpaid payment when a booking is cancelled", async () => {
    const booking = await createBooking(prisma, stay({ propertyId: requestPropertyId, checkIn: day(80), checkOut: day(83) }));
    await expect(createBooking(prisma, stay({ propertyId: requestPropertyId, customerId: otherCustomerId, checkIn: day(80), checkOut: day(83) }))).rejects.toThrow(/no longer available/);

    const cancelled = await transitionBooking(prisma, { bookingId: booking.id, to: "CANCELLED", actor: "CUSTOMER", actorId: customerId, reason: "Change of plans" });
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancelledAt).toBeInstanceOf(Date);

    const payment = await prisma.payment.findFirstOrThrow({ where: { bookingId: booking.id } });
    expect(payment.status).toBe("VOID");
    expect(payment.paidAt).toBeNull();

    const rebooked = await createBooking(prisma, stay({ propertyId: requestPropertyId, customerId: otherCustomerId, checkIn: day(80), checkOut: day(83) }));
    expect(rebooked.status).toBe("PENDING");
  });

  it("does not allow changing a finished booking", async () => {
    const booking = await prisma.booking.findFirstOrThrow({ where: { status: "CANCELLED", cancelledAt: { not: null } } });
    await expect(transitionBooking(prisma, { bookingId: booking.id, to: "CONFIRMED", actor: "ADMIN", actorId: null })).rejects.toThrow(BookingError);
  });

  it("never marks a payment PAID without a paid-at timestamp", async () => {
    const payment = await prisma.payment.findFirstOrThrow({ where: { status: "UNPAID" } });
    await expect(prisma.payment.update({ where: { id: payment.id }, data: { status: "PAID" } })).rejects.toThrow();
    await reconnect();
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("UNPAID");
  });
});
