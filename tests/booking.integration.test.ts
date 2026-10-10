import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bookingAccessKey, publicGuestName, verifyBookingAccessKey } from "@/lib/booking-access";
import {
  assertWithinBookingCap,
  BookingError,
  createBooking,
  findConflict,
  generateBookingReference,
  MAX_ACTIVE_BOOKINGS_PER_EMAIL,
  newIdempotencyKey,
  transitionBooking,
  type CreateBookingInput,
} from "@/lib/bookings";
import { ensureAdmin } from "@/lib/admin-bootstrap";
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

describe("guest checkout (no account)", () => {
  const guest = (overrides: Partial<CreateBookingInput> = {}): CreateBookingInput =>
    stay({ customerId: null, contactName: "Greta Guest", contactEmail: "greta@example.test", idempotencyKey: newIdempotencyKey(), ...overrides });

  it("creates a booking with no customer account, a server-side price and an UNPAID payment", async () => {
    const booking = await createBooking(prisma, guest({ checkIn: day(110), checkOut: day(113) }));
    expect(booking.customerId).toBeNull();
    expect(booking.status).toBe("CONFIRMED");
    expect(booking.contactEmail).toBe("greta@example.test");
    expect(booking.totalCents).toBe(20_000 * 3 + 5_000 + 3_000);
    expect(booking.accessVersion).toBe(1);
    const payment = await prisma.payment.findFirstOrThrow({ where: { bookingId: booking.id } });
    expect(payment).toMatchObject({ method: "PAY_AT_PROPERTY", status: "UNPAID", paidAt: null });
    const log = await prisma.auditLog.findFirstOrThrow({ where: { entityId: booking.id, action: "booking.created" } });
    expect(log.actorId).toBeNull();
  });

  it("still blocks overlapping dates for guests", async () => {
    await expect(createBooking(prisma, guest({ contactEmail: "other-guest@example.test", checkIn: day(111), checkOut: day(114) }))).rejects.toThrow(/no longer available/);
  });

  it("returns the same booking when the same checkout is submitted twice", async () => {
    const input = guest({ checkIn: day(120), checkOut: day(123) });
    const first = await createBooking(prisma, input);
    const retry = await createBooking(prisma, input);
    expect(retry.id).toBe(first.id);
    expect(retry.reference).toBe(first.reference);
    expect(await prisma.booking.count({ where: { idempotencyKey: input.idempotencyKey } })).toBe(1);
    expect(await prisma.payment.count({ where: { bookingId: first.id } })).toBe(1);
  });

  it("creates exactly one booking when the same checkout is submitted simultaneously", async () => {
    const input = guest({ checkIn: day(130), checkOut: day(133) });
    const results = await Promise.all([createBooking(prisma, input), createBooking(prisma, input)]);
    expect(results[0].id).toBe(results[1].id);
    expect(await prisma.booking.count({ where: { idempotencyKey: input.idempotencyKey } })).toBe(1);
  });

  it("does not let a different request reuse someone else's idempotency key", async () => {
    const input = guest({ checkIn: day(140), checkOut: day(143) });
    await createBooking(prisma, input);
    await expect(createBooking(prisma, { ...input, contactEmail: "attacker@example.test" })).rejects.toThrow(/expired/);
    await expect(createBooking(prisma, { ...input, checkIn: day(150), checkOut: day(153) })).rejects.toThrow(/expired/);
  });

  it("caps the number of upcoming bookings per email address", async () => {
    const email = "capped@example.test";
    for (let i = 0; i < MAX_ACTIVE_BOOKINGS_PER_EMAIL; i++) {
      await assertWithinBookingCap(prisma, email);
      await createBooking(prisma, guest({ propertyId: requestPropertyId, contactEmail: email, checkIn: day(160 + i * 4), checkOut: day(162 + i * 4) }));
    }
    await expect(assertWithinBookingCap(prisma, email)).rejects.toThrow(BookingError);
    // Cancelled bookings no longer count towards the cap.
    const one = await prisma.booking.findFirstOrThrow({ where: { contactEmail: email } });
    await transitionBooking(prisma, { bookingId: one.id, to: "CANCELLED", actor: "CUSTOMER", actorId: null });
    await expect(assertWithinBookingCap(prisma, email)).resolves.toBeUndefined();
  });

  it("issues an access key that is specific to the booking and can be revoked", async () => {
    const secret = "integration-secret-0123456789abcdef";
    const a = await createBooking(prisma, guest({ contactEmail: "key-a@example.test", checkIn: day(190), checkOut: day(192) }));
    const b = await createBooking(prisma, guest({ contactEmail: "key-b@example.test", checkIn: day(193), checkOut: day(195) }));
    const keyA = bookingAccessKey(secret, a.id, a.accessVersion);
    expect(verifyBookingAccessKey(secret, a.id, a.accessVersion, keyA)).toBe(true);
    expect(verifyBookingAccessKey(secret, b.id, b.accessVersion, keyA)).toBe(false);
    expect(verifyBookingAccessKey(secret, a.id, a.accessVersion, a.reference)).toBe(false);
    const revoked = await prisma.booking.update({ where: { id: a.id }, data: { accessVersion: { increment: 1 } } });
    expect(verifyBookingAccessKey(secret, revoked.id, revoked.accessVersion, keyA)).toBe(false);
  });

  it("lets a guest cancel under the same state machine as account bookings", async () => {
    const booking = await createBooking(prisma, guest({ contactEmail: "cancel@example.test", checkIn: day(200), checkOut: day(203) }));
    const cancelled = await transitionBooking(prisma, { bookingId: booking.id, to: "CANCELLED", actor: "CUSTOMER", actorId: null, reason: "Plans changed" });
    expect(cancelled.status).toBe("CANCELLED");
    expect((await prisma.payment.findFirstOrThrow({ where: { bookingId: booking.id } })).status).toBe("VOID");
    await expect(transitionBooking(prisma, { bookingId: booking.id, to: "CONFIRMED", actor: "CUSTOMER", actorId: null })).rejects.toThrow(BookingError);
  });
});

describe("guest reviews and legacy compatibility", () => {
  it("stores a guest review without an account, once per stay, with a public-safe name", async () => {
    const booking = await createBooking(
      prisma,
      stay({ customerId: null, contactName: "Rowan Reviewer", contactEmail: "rowan@example.test", idempotencyKey: newIdempotencyKey(), checkIn: day(210), checkOut: day(212) }),
    );
    await prisma.booking.update({ where: { id: booking.id }, data: { status: "COMPLETED" } });

    const review = await prisma.review.create({
      data: { bookingId: booking.id, propertyId: booking.propertyId, authorId: null, authorName: publicGuestName(booking.contactName), rating: 5, comment: "A wonderful, quiet stay." },
    });
    expect(review.authorId).toBeNull();
    expect(review.authorName).toBe("Rowan R.");

    // The unique index on bookingId makes a second review for the same stay impossible.
    await expect(
      prisma.review.create({ data: { bookingId: booking.id, propertyId: booking.propertyId, authorName: "Rowan R.", rating: 1, comment: "A duplicate review attempt." } }),
    ).rejects.toThrow();
    await reconnect();
    expect(await prisma.review.count({ where: { bookingId: booking.id } })).toBe(1);
  });

  it("keeps account-linked bookings and reviews working unchanged", async () => {
    const linked = await createBooking(prisma, stay({ checkIn: day(220), checkOut: day(222), idempotencyKey: newIdempotencyKey() }));
    expect(linked.customerId).toBe(customerId);
    await prisma.booking.update({ where: { id: linked.id }, data: { status: "COMPLETED" } });
    const review = await prisma.review.create({
      data: { bookingId: linked.id, propertyId: linked.propertyId, authorId: customerId, rating: 4, comment: "Linked account review." },
      include: { author: true },
    });
    expect(review.author?.email).toBe("customer@example.test");
    expect(review.authorName).toBeNull();

    // Guest and account bookings live side by side for the same property.
    const mixed = await prisma.booking.groupBy({ by: ["customerId"], where: { propertyId }, _count: { _all: true } });
    expect(mixed.some((row) => row.customerId === null)).toBe(true);
    expect(mixed.some((row) => row.customerId === customerId)).toBe(true);
  });

  it("keeps a review when its author's account is removed", async () => {
    const temp = await prisma.user.create({ data: { email: "leaving@example.test", name: "Leaving User", role: "CUSTOMER" } });
    const booking = await createBooking(prisma, stay({ customerId: null, contactEmail: "leaving@example.test", idempotencyKey: newIdempotencyKey(), checkIn: day(230), checkOut: day(232) }));
    const review = await prisma.review.create({ data: { bookingId: booking.id, propertyId: booking.propertyId, authorId: temp.id, authorName: "Leaving U.", rating: 5, comment: "Review that should survive." } });
    await prisma.user.delete({ where: { id: temp.id } });
    const after = await prisma.review.findUniqueOrThrow({ where: { id: review.id } });
    expect(after.authorId).toBeNull();
    expect(after.authorName).toBe("Leaving U.");
  });
});

describe("property categories in the database", () => {
  it("has the six starter categories after migration, all live", async () => {
    const starters = await prisma.category.findMany({ where: { id: { startsWith: "cat_" } }, orderBy: { name: "asc" } });
    expect(starters.map((c) => c.slug)).toEqual(["apartment", "beach-house", "cabin", "hotel", "resort", "villa"]);
    expect(starters.every((c) => c.status === "ACTIVE")).toBe(true);
  });

  it("stores a new category and lets a listing use it", async () => {
    const category = await prisma.category.create({ data: { name: "Tree House", slug: "tree-house", status: "ACTIVE" } });
    const updated = await prisma.property.update({ where: { id: propertyId }, data: { categoryId: category.id }, include: { category: true } });
    expect(updated.category?.name).toBe("Tree House");
  });

  it("rejects a duplicate slug", async () => {
    await expect(prisma.category.create({ data: { name: "Treehouse Two", slug: "tree-house" } })).rejects.toThrow();
    await reconnect();
  });

  it("rejects a duplicate name regardless of letter case", async () => {
    await expect(prisma.category.create({ data: { name: "TREE HOUSE", slug: "tree-house-upper" } })).rejects.toThrow();
    await reconnect();
    await expect(prisma.category.create({ data: { name: "villa", slug: "villa-lower" } })).rejects.toThrow();
    await reconnect();
    expect(await prisma.category.count({ where: { name: { equals: "tree house", mode: "insensitive" } } })).toBe(1);
  });

  it("keeps an owner's request pending and separate from live categories", async () => {
    const request = await prisma.category.create({ data: { name: "Houseboat", slug: "houseboat", status: "PENDING", requestedById: ownerId } });
    const live = await prisma.category.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
    expect(live.some((c) => c.id === request.id)).toBe(false);
    const approved = await prisma.category.update({ where: { id: request.id }, data: { status: "ACTIVE" } });
    expect(approved.status).toBe("ACTIVE");
    expect(approved.requestedById).toBe(ownerId);
  });

  it("does not allow deleting a category that listings still use", async () => {
    const used = await prisma.category.findUniqueOrThrow({ where: { slug: "tree-house" } });
    await expect(prisma.category.delete({ where: { id: used.id } })).rejects.toThrow();
    await reconnect();
    expect(await prisma.category.count({ where: { id: used.id } })).toBe(1);
  });
});

describe("administrator provisioning (ADMIN_EMAIL)", () => {
  const roleOf = async (email: string) => (await prisma.user.findUnique({ where: { email } }))?.role;

  it("does nothing when no address is configured or it is invalid", async () => {
    const before = await prisma.user.count({ where: { role: "ADMIN" } });
    expect(await ensureAdmin(prisma, "")).toBe("not-configured");
    expect(await ensureAdmin(prisma, undefined)).toBe("not-configured");
    expect(await ensureAdmin(prisma, "nonsense")).toBe("invalid-email");
    expect(await ensureAdmin(prisma, "owner@example.test,customer@example.test")).toBe("invalid-email");
    expect(await prisma.user.count({ where: { role: "ADMIN" } })).toBe(before);
  });

  it("never creates an account for an address that is not registered", async () => {
    const users = await prisma.user.count();
    expect(await ensureAdmin(prisma, "nobody@example.test")).toBe("no-account");
    expect(await prisma.user.count()).toBe(users);
    expect(await prisma.user.findUnique({ where: { email: "nobody@example.test" } })).toBeNull();
  });

  it("promotes only the named, existing account and records it in the audit log", async () => {
    const chosen = await prisma.user.create({ data: { email: "site.owner@example.test", name: "Site Owner", role: "OWNER" } });
    expect(await ensureAdmin(prisma, " Site.Owner@Example.test ")).toBe("promoted");
    expect(await roleOf("site.owner@example.test")).toBe("ADMIN");
    // Nobody else changed role.
    expect(await roleOf("owner@example.test")).toBe("OWNER");
    expect(await roleOf("customer@example.test")).toBe("CUSTOMER");
    expect(await prisma.user.count({ where: { role: "ADMIN" } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "user.promoted_to_admin", entityId: chosen.id } })).toBe(1);
  });

  it("is safe to run again on every deployment", async () => {
    expect(await ensureAdmin(prisma, "site.owner@example.test")).toBe("already-admin");
    expect(await prisma.auditLog.count({ where: { action: "user.promoted_to_admin" } })).toBe(1);
  });

  it("does not promote a suspended account", async () => {
    await prisma.user.create({ data: { email: "blocked@example.test", name: "Blocked", role: "OWNER", status: "SUSPENDED" } });
    expect(await ensureAdmin(prisma, "blocked@example.test")).toBe("suspended");
    expect(await roleOf("blocked@example.test")).toBe("OWNER");
  });
});
