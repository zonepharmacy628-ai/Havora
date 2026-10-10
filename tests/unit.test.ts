import { describe, expect, it } from "vitest";
import {
  addDeviceBooking,
  bookingAccessKey,
  normaliseReference,
  parseDeviceBookings,
  publicGuestName,
  serialiseDeviceBookings,
  verifyBookingAccessKey,
} from "@/lib/booking-access";
import {
  bookingActorFor,
  canApproveListing,
  canManageProperty,
  isAdmin,
  canTransition,
  canViewBooking,
  customerCancellation,
  freeCancellationDeadline,
  HOST_ROLES,
  validateStay,
} from "@/lib/booking-rules";
import { addDays, isIsoDate, nightsBetween, rangesOverlap, todayIn } from "@/lib/dates";
import { applyBps, formatMoney, parseMoneyToCents } from "@/lib/money";
import { normaliseAdminEmail } from "@/lib/admin-bootstrap";
import { calculateQuote } from "@/lib/pricing";
import { settingsFromRows } from "@/lib/settings-core";
import { bookingLookupSchema, bookingSchema, categorySchema, ownerRegisterSchema, propertySchema } from "@/lib/validation";
import { canReviewCategories, categorySlug, initialCategoryStatus, isSelectableCategory, normaliseCategoryName } from "@/lib/category-rules";

describe("pricing", () => {
  it("calculates a quote in integer cents", () => {
    const quote = calculateQuote({ nightlyPriceCents: 18_500, cleaningFeeCents: 6_500, nights: 5, serviceFeeBps: 500, commissionBps: 1200 });
    expect(quote.subtotalCents).toBe(92_500);
    expect(quote.serviceFeeCents).toBe(4_625);
    expect(quote.totalCents).toBe(103_625);
    expect(quote.commissionCents).toBe(11_100);
    expect(quote.ownerEarningsCents).toBe(92_500 + 6_500 - 11_100);
  });

  it("always satisfies total = subtotal + cleaning + service fee", () => {
    for (const nightly of [9_999, 12_345, 33_333]) {
      for (const nights of [1, 3, 7, 29]) {
        const q = calculateQuote({ nightlyPriceCents: nightly, cleaningFeeCents: 4_550, nights, serviceFeeBps: 735, commissionBps: 1250 });
        expect(Number.isInteger(q.totalCents)).toBe(true);
        expect(q.totalCents).toBe(q.subtotalCents + q.cleaningFeeCents + q.serviceFeeCents);
      }
    }
  });

  it("rejects invalid input", () => {
    expect(() => calculateQuote({ nightlyPriceCents: 100.5, cleaningFeeCents: 0, nights: 1, serviceFeeBps: 0, commissionBps: 0 })).toThrow();
    expect(() => calculateQuote({ nightlyPriceCents: 100, cleaningFeeCents: 0, nights: 0, serviceFeeBps: 0, commissionBps: 0 })).toThrow();
    expect(() => calculateQuote({ nightlyPriceCents: -1, cleaningFeeCents: 0, nights: 1, serviceFeeBps: 0, commissionBps: 0 })).toThrow();
  });
});

describe("money", () => {
  it("parses decimal input without float drift", () => {
    expect(parseMoneyToCents("185")).toBe(18_500);
    expect(parseMoneyToCents("185.5")).toBe(18_550);
    expect(parseMoneyToCents("0.07")).toBe(7);
    expect(parseMoneyToCents("1,250.99")).toBe(125_099);
    expect(parseMoneyToCents("19.999")).toBeNull();
    expect(parseMoneyToCents("-5")).toBeNull();
    expect(parseMoneyToCents("abc")).toBeNull();
  });

  it("formats and applies basis points", () => {
    expect(formatMoney(103_625)).toBe("$1,036.25");
    expect(formatMoney(18_500)).toBe("$185");
    expect(applyBps(92_500, 500)).toBe(4_625);
    expect(applyBps(333, 1250)).toBe(42);
  });
});

describe("dates", () => {
  it("validates ISO calendar dates", () => {
    expect(isIsoDate("2026-10-20")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("20/10/2026")).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
  });

  it("does date arithmetic across month and DST boundaries", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
    expect(nightsBetween("2026-10-20", "2026-10-25")).toBe(5);
    expect(nightsBetween("2026-12-30", "2027-01-02")).toBe(3);
  });

  it("treats check-out day as free for the next guest (half-open ranges)", () => {
    expect(rangesOverlap("2026-10-20", "2026-10-25", "2026-10-25", "2026-10-28")).toBe(false);
    expect(rangesOverlap("2026-10-20", "2026-10-25", "2026-10-24", "2026-10-28")).toBe(true);
    expect(rangesOverlap("2026-10-20", "2026-10-25", "2026-10-21", "2026-10-22")).toBe(true);
  });

  it("computes today in the property's timezone", () => {
    const instant = new Date("2026-10-08T22:30:00Z");
    expect(todayIn("Asia/Makassar", instant)).toBe("2026-10-09");
    expect(todayIn("America/Los_Angeles", instant)).toBe("2026-10-08");
    expect(todayIn("Not/AZone", instant)).toBe("2026-10-08");
  });
});

describe("stay validation", () => {
  const property = { maxGuests: 4, minNights: 2, maxNights: 14 };
  const base = { checkIn: "2026-10-20", checkOut: "2026-10-25", adults: 2, children: 0, today: "2026-10-08", property };

  it("accepts a valid stay", () => expect(validateStay(base)).toBeNull());
  it("rejects past check-in", () => expect(validateStay({ ...base, today: "2026-10-21" })).toMatch(/past/));
  it("rejects check-out on or before check-in", () => expect(validateStay({ ...base, checkOut: "2026-10-20" })).toMatch(/after check-in/));
  it("enforces minimum nights", () => expect(validateStay({ ...base, checkOut: "2026-10-21" })).toMatch(/minimum stay/));
  it("enforces maximum nights", () => expect(validateStay({ ...base, checkOut: "2026-11-20" })).toMatch(/up to 14 nights/));
  it("enforces guest capacity", () => expect(validateStay({ ...base, adults: 3, children: 2 })).toMatch(/maximum of 4 guests/));
  it("requires an adult", () => expect(validateStay({ ...base, adults: 0 })).toMatch(/adult/));
});

describe("booking status transitions", () => {
  it("lets only hosts and admins confirm or decline", () => {
    expect(canTransition("PENDING", "CONFIRMED", "OWNER")).toBe(true);
    expect(canTransition("PENDING", "CONFIRMED", "ADMIN")).toBe(true);
    expect(canTransition("PENDING", "CONFIRMED", "CUSTOMER")).toBe(false);
    expect(canTransition("PENDING", "DECLINED", "CUSTOMER")).toBe(false);
  });

  it("lets customers cancel or request cancellation but not approve it", () => {
    expect(canTransition("CONFIRMED", "CANCELLED", "CUSTOMER")).toBe(true);
    expect(canTransition("CONFIRMED", "CANCELLATION_REQUESTED", "CUSTOMER")).toBe(true);
    expect(canTransition("CANCELLATION_REQUESTED", "CANCELLED", "CUSTOMER")).toBe(false);
    expect(canTransition("CANCELLATION_REQUESTED", "CANCELLED", "OWNER")).toBe(true);
  });

  it("treats finished states as final", () => {
    for (const from of ["CANCELLED", "DECLINED", "COMPLETED", "NO_SHOW"] as const) {
      for (const to of ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"] as const) {
        expect(canTransition(from, to, "ADMIN")).toBe(false);
      }
    }
    expect(canTransition("CONFIRMED", "COMPLETED", "CUSTOMER")).toBe(false);
  });
});

describe("cancellation rules", () => {
  it("computes the free cancellation deadline per policy", () => {
    expect(freeCancellationDeadline("2026-10-20", "FLEXIBLE")).toBe("2026-10-19");
    expect(freeCancellationDeadline("2026-10-20", "MODERATE")).toBe("2026-10-15");
    expect(freeCancellationDeadline("2026-10-20", "STRICT")).toBe("2026-10-06");
  });

  it("allows direct cancellation inside the window and requests after it", () => {
    const booking = { status: "CONFIRMED" as const, checkIn: "2026-10-20", cancellationPolicy: "MODERATE" as const };
    expect(customerCancellation(booking, "2026-10-15").kind).toBe("direct");
    expect(customerCancellation(booking, "2026-10-16").kind).toBe("request");
    expect(customerCancellation(booking, "2026-10-20").kind).toBe("none");
    expect(customerCancellation({ ...booking, status: "PENDING" }, "2026-10-19").kind).toBe("direct");
    expect(customerCancellation({ ...booking, status: "CANCELLED" }, "2026-10-01").kind).toBe("none");
  });
});

describe("permissions", () => {
  const owner = { id: "owner-1", role: "OWNER" as const };
  const otherOwner = { id: "owner-2", role: "OWNER" as const };
  const customer = { id: "cust-1", role: "CUSTOMER" as const };
  const otherCustomer = { id: "cust-2", role: "CUSTOMER" as const };
  const admin = { id: "admin-1", role: "ADMIN" as const };
  const property = { ownerId: "owner-1" };
  const booking = { customerId: "cust-1", property };

  it("restricts property management to the owning owner and admins", () => {
    expect(canManageProperty(owner, property)).toBe(true);
    expect(canManageProperty(admin, property)).toBe(true);
    expect(canManageProperty(otherOwner, property)).toBe(false);
    expect(canManageProperty(customer, property)).toBe(false);
    // A customer cannot manage a property even if their id matched an owner id.
    expect(canManageProperty({ id: "owner-1", role: "CUSTOMER" }, property)).toBe(false);
  });

  it("restricts booking access to its customer, the property's owner and admins", () => {
    expect(canViewBooking(customer, booking)).toBe(true);
    expect(canViewBooking(owner, booking)).toBe(true);
    expect(canViewBooking(admin, booking)).toBe(true);
    expect(canViewBooking(otherCustomer, booking)).toBe(false);
    expect(canViewBooking(otherOwner, booking)).toBe(false);
  });

  it("assigns the correct actor role for a booking", () => {
    expect(bookingActorFor(customer, booking)).toBe("CUSTOMER");
    expect(bookingActorFor(owner, booking)).toBe("OWNER");
    expect(bookingActorFor(admin, booking)).toBe("ADMIN");
    expect(bookingActorFor(otherOwner, booking)).toBeNull();
    expect(bookingActorFor(otherCustomer, booking)).toBeNull();
  });
});

describe("input validation", () => {
  it("never lets a role be chosen at sign-up", () => {
    const base = { name: "Jane Doe", email: "jane@example.com", password: "long-enough-pw", terms: "on" };
    // Host registration has no role field at all: anything a client adds is discarded.
    const parsed = ownerRegisterSchema.parse({ ...base, role: "ADMIN", accountType: "ADMIN" });
    expect(parsed).not.toHaveProperty("role");
    expect(parsed).not.toHaveProperty("accountType");
    expect(Object.keys(parsed).sort()).toEqual(["email", "name", "password", "terms"]);
    expect(ownerRegisterSchema.safeParse({ ...base, password: "short" }).success).toBe(false);
    expect(ownerRegisterSchema.safeParse({ ...base, terms: undefined }).success).toBe(false);
    expect(ownerRegisterSchema.safeParse({ ...base, email: "not-an-email" }).success).toBe(false);
  });

  it("ignores client-supplied prices on bookings", () => {
    const parsed = bookingSchema.parse({
      propertyId: "prop_1",
      checkIn: "2026-10-20",
      checkOut: "2026-10-25",
      adults: "2",
      children: "0",
      paymentMethod: "PAY_AT_PROPERTY",
      contactName: "Jane Doe",
      contactEmail: "JANE@example.com ",
      contactPhone: "+44 20 7946 0958",
      idempotencyKey: "abcDEF123456_-abcDEF1234",
      totalCents: "1",
      nightlyPriceCents: "1",
    });
    expect(parsed).not.toHaveProperty("totalCents");
    expect(parsed).not.toHaveProperty("nightlyPriceCents");
    expect(parsed.contactEmail).toBe("jane@example.com");
    expect(parsed.adults).toBe(2);
  });

  it("validates property listings", () => {
    const valid = {
      title: "Luxury Villa with Private Pool",
      summary: "A serene villa with a private pool and open-air living.",
      description: "x".repeat(120),
      categoryId: "cat_villa",
      addressLine: "Jalan Raya 12",
      city: "Bali",
      country: "Indonesia",
      countryCode: "id",
      timezone: "Asia/Makassar",
      nightlyPrice: "185.50",
      cleaningFee: "65",
      maxGuests: "8",
      bedrooms: "4",
      beds: "5",
      bathrooms: "4",
      checkInFrom: "15:00",
      checkOutBy: "11:00",
      minNights: "2",
      maxNights: "30",
      cancellationPolicy: "MODERATE",
      instantBook: "on",
    };
    const parsed = propertySchema.parse(valid);
    expect(parsed.nightlyPrice).toBe(18_550);
    expect(parsed.countryCode).toBe("ID");
    expect(parsed.instantBook).toBe(true);
    expect(parsed.payAtPropertyEnabled).toBe(false);
    expect(propertySchema.safeParse({ ...valid, timezone: "Mars/Olympus" }).success).toBe(false);
    expect(propertySchema.safeParse({ ...valid, nightlyPrice: "-10" }).success).toBe(false);
    expect(propertySchema.safeParse({ ...valid, minNights: "10", maxNights: "5" }).success).toBe(false);
  });
});

describe("guest checkout validation", () => {
  const guest = {
    propertyId: "prop_1",
    checkIn: "2026-10-20",
    checkOut: "2026-10-25",
    adults: "2",
    children: "0",
    paymentMethod: "PAY_AT_PROPERTY",
    contactName: "Jane Doe",
    contactEmail: "jane@example.com",
    contactPhone: "+44 20 7946 0958",
    idempotencyKey: "abcDEF123456_-abcDEF1234",
  };

  it("accepts complete guest details", () => expect(bookingSchema.safeParse(guest).success).toBe(true));

  it("requires a valid name, email and phone", () => {
    expect(bookingSchema.safeParse({ ...guest, contactName: "" }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...guest, contactEmail: "jane@" }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...guest, contactPhone: "12" }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...guest, contactPhone: undefined }).success).toBe(false);
  });

  it("requires a well-formed idempotency key", () => {
    expect(bookingSchema.safeParse({ ...guest, idempotencyKey: undefined }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...guest, idempotencyKey: "short" }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...guest, idempotencyKey: "has spaces and symbols!!" }).success).toBe(false);
  });

  it("validates the booking lookup form", () => {
    expect(bookingLookupSchema.safeParse({ reference: "HV-AB23CD45", email: "Jane@Example.com" }).success).toBe(true);
    expect(bookingLookupSchema.parse({ reference: "HV-AB23CD45", email: " Jane@Example.com " }).email).toBe("jane@example.com");
    expect(bookingLookupSchema.safeParse({ reference: "", email: "jane@example.com" }).success).toBe(false);
    expect(bookingLookupSchema.safeParse({ reference: "HV-AB23CD45", email: "nope" }).success).toBe(false);
  });
});

describe("private booking access", () => {
  const secret = "test-secret-with-enough-length-0123456789";
  const key = bookingAccessKey(secret, "booking_1", 1);

  it("produces a long, URL-safe key", () => {
    expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(bookingAccessKey(secret, "booking_1", 1)).toBe(key);
  });

  it("accepts only the exact key for that booking and version", () => {
    expect(verifyBookingAccessKey(secret, "booking_1", 1, key)).toBe(true);
    expect(verifyBookingAccessKey(secret, "booking_2", 1, key)).toBe(false);
    expect(verifyBookingAccessKey("another-secret-with-enough-length-000", "booking_1", 1, key)).toBe(false);
    expect(verifyBookingAccessKey(secret, "booking_1", 1, key.slice(0, -1) + (key.endsWith("A") ? "B" : "A"))).toBe(false);
  });

  it("is revoked when the access version changes", () => {
    expect(verifyBookingAccessKey(secret, "booking_1", 2, key)).toBe(false);
  });

  it("never treats a booking reference, empty value or junk as a key", () => {
    for (const bad of ["HV-AB23CD45", "", undefined, null, 42, "x".repeat(500), {}]) {
      expect(verifyBookingAccessKey(secret, "booking_1", 1, bad)).toBe(false);
    }
  });

  it("refuses to sign with a missing or weak secret", () => {
    expect(() => bookingAccessKey("", "booking_1", 1)).toThrow();
    expect(() => bookingAccessKey("short", "booking_1", 1)).toThrow();
  });

  it("normalises references and rejects malformed ones", () => {
    expect(normaliseReference("hv-ab23cd45")).toBe("HV-AB23CD45");
    expect(normaliseReference(" AB23CD45 ")).toBe("HV-AB23CD45");
    expect(normaliseReference("HVAB23CD45")).toBe("HV-AB23CD45");
    expect(normaliseReference("HV-AB23")).toBeNull();
    expect(normaliseReference("HV-AB23CD4O")).toBeNull();
    expect(normaliseReference("../../etc/passwd")).toBeNull();
    expect(normaliseReference(undefined)).toBeNull();
  });

  it("round-trips the device cookie and ignores malformed entries", () => {
    const entries = addDeviceBooking([], { reference: "HV-AB23CD45", key });
    const again = addDeviceBooking(entries, { reference: "HV-ZZ99YY88", key });
    expect(again.map((e) => e.reference)).toEqual(["HV-ZZ99YY88", "HV-AB23CD45"]);
    expect(parseDeviceBookings(serialiseDeviceBookings(again))).toEqual(again);
    expect(addDeviceBooking(again, { reference: "HV-AB23CD45", key })).toHaveLength(2);
    expect(parseDeviceBookings("garbage,HV-AB23CD45,HV-AB23CD45.short,<script>.x")).toEqual([]);
    expect(parseDeviceBookings(undefined)).toEqual([]);
    const many = Array.from({ length: 30 }, (_, i) => `HV-AAAAAA${String.fromCharCode(65 + (i % 20))}${2 + (i % 8)}.${key}`).join(",");
    expect(parseDeviceBookings(many).length).toBeLessThanOrEqual(12);
  });

  it("shows guests publicly as first name and last initial only", () => {
    expect(publicGuestName("Jane Doe")).toBe("Jane D.");
    expect(publicGuestName("  maria   del carmen   garcia ")).toBe("maria G.");
    expect(publicGuestName("Cher")).toBe("Cher");
    expect(publicGuestName("")).toBe("Guest");
    expect(publicGuestName("Jane Doe")).not.toContain("Doe");
  });
});

describe("listing approval authority", () => {
  const adminA = { id: "admin-a", role: "ADMIN" as const };
  const owner = { id: "owner-1", role: "OWNER" as const };

  it("lets an administrator approve any listing, including their own", () => {
    expect(canApproveListing(adminA)).toBe(true);
    // Ownership is irrelevant for an administrator: they manage their own and everyone else's.
    expect(canManageProperty(adminA, { ownerId: "admin-a" })).toBe(true);
    expect(canManageProperty(adminA, { ownerId: "owner-1" })).toBe(true);
  });

  it("never lets owners or customers approve listings — not even their own", () => {
    expect(canApproveListing(owner)).toBe(false);
    expect(canApproveListing({ id: "c", role: "CUSTOMER" })).toBe(false);
  });

  it("does not give owners admin powers over other people's listings", () => {
    expect(canManageProperty(owner, { ownerId: "owner-1" })).toBe(true);
    expect(canManageProperty(owner, { ownerId: "admin-a" })).toBe(false);
    expect(canManageProperty(owner, { ownerId: "owner-2" })).toBe(false);
    expect(isAdmin(owner)).toBe(false);
  });

  it("lets administrators manage their own listings like any host", () => {
    expect(HOST_ROLES).toEqual(["OWNER", "ADMIN"]);
    expect(canManageProperty(adminA, { ownerId: "admin-a" })).toBe(true);
  });

  it("treats guest bookings (no account) as visible only to the host and admins by session", () => {
    const guestBooking = { customerId: null, property: { ownerId: "owner-1" } };
    expect(bookingActorFor(owner, guestBooking)).toBe("OWNER");
    expect(bookingActorFor(adminA, guestBooking)).toBe("ADMIN");
    expect(bookingActorFor({ id: "cust-9", role: "CUSTOMER" }, guestBooking)).toBeNull();
    expect(canViewBooking({ id: "owner-2", role: "OWNER" }, guestBooking)).toBe(false);
  });
});

describe("property categories", () => {
  it("lets an administrator create a live category and an owner only request one", () => {
    expect(initialCategoryStatus("ADMIN")).toBe("ACTIVE");
    expect(initialCategoryStatus("OWNER")).toBe("PENDING");
    expect(initialCategoryStatus("CUSTOMER")).toBeNull();
  });

  it("lets only administrators approve or reject requests", () => {
    expect(canReviewCategories("ADMIN")).toBe(true);
    expect(canReviewCategories("OWNER")).toBe(false);
    expect(canReviewCategories("CUSTOMER")).toBe(false);
  });

  it("only allows live categories on a listing", () => {
    expect(isSelectableCategory({ status: "ACTIVE" })).toBe(true);
    expect(isSelectableCategory({ status: "PENDING" })).toBe(false);
    expect(isSelectableCategory({ status: "REJECTED" })).toBe(false);
    expect(isSelectableCategory(null)).toBe(false);
  });

  it("builds slugs that make differently typed names collide", () => {
    expect(categorySlug("Tree House")).toBe("tree-house");
    expect(categorySlug("  tree   HOUSE ")).toBe("tree-house");
    expect(categorySlug("Tree-House!")).toBe("tree-house");
    expect(categorySlug("Château")).toBe("chateau");
    expect(categorySlug("***")).toBe("");
    expect(normaliseCategoryName("  Tree    House ")).toBe("Tree House");
  });

  it("validates the category form", () => {
    expect(categorySchema.safeParse({ name: "Tree House" }).success).toBe(true);
    expect(categorySchema.safeParse({ name: "Bed & Breakfast", description: "Small hosted stays." }).success).toBe(true);
    expect(categorySchema.safeParse({ name: "" }).success).toBe(false);
    expect(categorySchema.safeParse({ name: "A" }).success).toBe(false);
    expect(categorySchema.safeParse({ name: "x".repeat(41) }).success).toBe(false);
    expect(categorySchema.safeParse({ name: "<script>alert(1)</script>" }).success).toBe(false);
    expect(categorySchema.safeParse({ name: "Tree House", description: "x".repeat(201) }).success).toBe(false);
    // Extra fields such as a status or owner are never accepted from the form.
    const parsed = categorySchema.parse({ name: "Tree House", status: "ACTIVE", requestedById: "someone" });
    expect(parsed).not.toHaveProperty("status");
    expect(parsed).not.toHaveProperty("requestedById");
  });

  it("requires a category on a listing", () => {
    expect(propertySchema.safeParse({ categoryId: "" }).error?.issues.some((issue) => issue.path[0] === "categoryId")).toBe(true);
  });
});

describe("administrator email setting", () => {
  it("normalises a valid address and rejects anything else", () => {
    expect(normaliseAdminEmail("  Owner@Example.COM ")).toBe("owner@example.com");
    expect(normaliseAdminEmail("")).toBeNull();
    expect(normaliseAdminEmail(undefined)).toBeNull();
    expect(normaliseAdminEmail("not-an-email")).toBe("");
    // Exactly one address: lists are refused, so the setting can never promote several accounts.
    expect(normaliseAdminEmail("a@example.com,b@example.com")).toBe("");
    expect(normaliseAdminEmail("a@example.com b@example.com")).toBe("");
  });
});

describe("platform settings", () => {
  it("falls back to safe defaults for missing or corrupt values", () => {
    const settings = settingsFromRows([
      { key: "commission_rate_bps", value: "not-a-number" },
      { key: "service_fee_rate_bps", value: "750" },
      { key: "require_listing_approval", value: "false" },
    ]);
    expect(settings.commissionRateBps).toBe(1200);
    expect(settings.serviceFeeRateBps).toBe(750);
    expect(settings.requireListingApproval).toBe(false);
  });
});
