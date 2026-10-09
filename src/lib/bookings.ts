import { randomInt } from "node:crypto";
import { Prisma, type BookingStatus, type PrismaClient } from "@prisma/client";
import { ACTIVE_BOOKING_STATUSES, canTransition, validateStay, type BookingActor } from "./booking-rules";
import { nightsBetween, parseDate, toIso, todayIn } from "./dates";
import { calculateQuote, type Quote } from "./pricing";
import { settingsFromRows } from "./settings-core";

type Tx = Prisma.TransactionClient;

/** An expected, user-facing booking failure (safe to show verbatim). */
export class BookingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingError";
  }
}

const REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateBookingReference(): string {
  let code = "";
  for (let i = 0; i < 8; i++) code += REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)];
  return `HV-${code}`;
}

export type CreateBookingInput = {
  propertyId: string;
  customerId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  paymentMethod: "PAY_AT_PROPERTY" | "ONLINE";
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  specialRequests?: string;
  additionalGuests?: string[];
};

/** Finds anything that already occupies [checkIn, checkOut) for the property. */
export async function findConflict(
  db: Tx | PrismaClient,
  propertyId: string,
  checkIn: string,
  checkOut: string,
): Promise<"booking" | "blocked" | null> {
  const start = parseDate(checkIn);
  const end = parseDate(checkOut);
  const booking = await db.booking.findFirst({
    where: {
      propertyId,
      status: { in: ACTIVE_BOOKING_STATUSES },
      checkIn: { lt: end },
      checkOut: { gt: start },
    },
    select: { id: true },
  });
  if (booking) return "booking";
  const block = await db.availabilityBlock.findFirst({
    where: { propertyId, startDate: { lt: end }, endDate: { gt: start } },
    select: { id: true },
  });
  return block ? "blocked" : null;
}

const UNAVAILABLE = "Sorry, those dates are no longer available. Please choose different dates.";

/**
 * Creates a booking atomically. Nothing price- or availability-related is
 * taken from the client: the property row is locked, availability is
 * re-checked and the price is recalculated from database values inside one
 * transaction. A PostgreSQL exclusion constraint ("Booking_no_overlap") is the
 * final backstop against concurrent double-bookings.
 */
export async function createBooking(prisma: PrismaClient, input: CreateBookingInput) {
  if (input.paymentMethod !== "PAY_AT_PROPERTY") {
    throw new BookingError("Online payment is not available yet. Please choose Pay at Property.");
  }

  try {
    return await prisma.$transaction(async (tx) => {
      // Serialise concurrent bookings for the same property.
      await tx.$queryRaw`SELECT "id" FROM "Property" WHERE "id" = ${input.propertyId} FOR UPDATE`;

      const property = await tx.property.findUnique({
        where: { id: input.propertyId },
        include: { owner: { select: { status: true } } },
      });
      if (!property || property.status !== "PUBLISHED" || property.owner.status !== "ACTIVE") {
        throw new BookingError("This property is not available for booking.");
      }
      if (property.ownerId === input.customerId) {
        throw new BookingError("You cannot book your own property.");
      }
      if (!property.payAtPropertyEnabled) {
        throw new BookingError("This property does not currently accept Pay at Property bookings.");
      }

      const problem = validateStay({
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        adults: input.adults,
        children: input.children,
        today: todayIn(property.timezone),
        property,
      });
      if (problem) throw new BookingError(problem);

      if (await findConflict(tx, property.id, input.checkIn, input.checkOut)) {
        throw new BookingError(UNAVAILABLE);
      }

      const settings = settingsFromRows(await tx.platformSetting.findMany());
      const quote: Quote = calculateQuote({
        nightlyPriceCents: property.nightlyPriceCents,
        cleaningFeeCents: property.cleaningFeeCents,
        nights: nightsBetween(input.checkIn, input.checkOut),
        serviceFeeBps: settings.serviceFeeRateBps,
        commissionBps: settings.commissionRateBps,
      });

      const guestNames = (input.additionalGuests ?? []).map((name) => name.trim()).filter(Boolean);

      const booking = await tx.booking.create({
        data: {
          reference: generateBookingReference(),
          propertyId: property.id,
          customerId: input.customerId,
          checkIn: parseDate(input.checkIn),
          checkOut: parseDate(input.checkOut),
          nights: quote.nights,
          adults: input.adults,
          children: input.children,
          status: property.instantBook ? "CONFIRMED" : "PENDING",
          currency: property.currency,
          nightlyPriceCents: quote.nightlyPriceCents,
          subtotalCents: quote.subtotalCents,
          cleaningFeeCents: quote.cleaningFeeCents,
          serviceFeeCents: quote.serviceFeeCents,
          totalCents: quote.totalCents,
          commissionRateBps: quote.commissionRateBps,
          commissionCents: quote.commissionCents,
          ownerEarningsCents: quote.ownerEarningsCents,
          contactName: input.contactName,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
          specialRequests: input.specialRequests || null,
          cancellationPolicy: property.cancellationPolicy,
          guests: {
            create: [
              { fullName: input.contactName, isPrimary: true },
              ...guestNames.map((fullName) => ({ fullName })),
            ],
          },
          // The payment record starts UNPAID and only changes when the host records
          // that money was actually collected at the property.
          payments: {
            create: {
              method: "PAY_AT_PROPERTY",
              status: "UNPAID",
              amountCents: quote.totalCents,
              currency: property.currency,
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: input.customerId,
          action: "booking.created",
          entityType: "Booking",
          entityId: booking.id,
          metadata: { reference: booking.reference, status: booking.status, totalCents: booking.totalCents },
        },
      });

      return booking;
    });
  } catch (error) {
    if (isOverlapViolation(error)) throw new BookingError(UNAVAILABLE);
    throw error;
  }
}

/** True when PostgreSQL rejected a write because of the booking exclusion constraint. */
export function isOverlapViolation(error: unknown): boolean {
  const text = error instanceof Error ? `${error.message} ${JSON.stringify((error as { meta?: unknown }).meta ?? "")}` : "";
  return text.includes("Booking_no_overlap") || text.includes("23P01");
}

export type TransitionInput = {
  bookingId: string;
  to: BookingStatus;
  actor: BookingActor;
  actorId: string | null;
  reason?: string;
};

/** Applies a status change if the state machine allows it for this actor. */
export async function transitionBooking(prisma: PrismaClient, input: TransitionInput) {
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${input.bookingId} FOR UPDATE`;
      const booking = await tx.booking.findUnique({ where: { id: input.bookingId } });
      if (!booking) throw new BookingError("Booking not found.");
      if (!canTransition(booking.status, input.to, input.actor)) {
        throw new BookingError("This booking can no longer be changed that way.");
      }

      const now = new Date();
      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: input.to,
          ...(input.to === "CANCELLED" && { cancelledAt: now, cancellationReason: input.reason ?? booking.cancellationReason }),
          ...(input.to === "CANCELLATION_REQUESTED" && { cancellationRequestedAt: now, cancellationReason: input.reason ?? null }),
          ...(input.to === "DECLINED" && { cancellationReason: input.reason ?? null }),
        },
      });

      // An unpaid payment for a booking that will not happen is voided — never refunded or paid.
      if (input.to === "CANCELLED" || input.to === "DECLINED" || input.to === "NO_SHOW") {
        await tx.payment.updateMany({ where: { bookingId: booking.id, status: "UNPAID" }, data: { status: "VOID" } });
      }

      await tx.auditLog.create({
        data: {
          actorId: input.actorId,
          action: `booking.${input.to.toLowerCase()}`,
          entityType: "Booking",
          entityId: booking.id,
          metadata: { reference: booking.reference, from: booking.status, to: input.to, as: input.actor, reason: input.reason ?? null },
        },
      });
      return updated;
    });
  } catch (error) {
    // Re-confirming a booking whose dates were taken meanwhile is blocked by the constraint.
    if (isOverlapViolation(error)) throw new BookingError("Those dates have since been booked by another guest.");
    throw error;
  }
}

/** Marks confirmed stays whose check-out date has passed as completed. */
export async function completeFinishedStays(prisma: PrismaClient, where: Prisma.BookingWhereInput = {}): Promise<number> {
  // UTC "yesterday" is safely in the past for every timezone's local date.
  const cutoff = parseDate(toIso(new Date(Date.now() - 86_400_000)));
  const result = await prisma.booking.updateMany({
    where: { ...where, status: "CONFIRMED", checkOut: { lt: cutoff } },
    data: { status: "COMPLETED" },
  });
  return result.count;
}

/** Unavailable half-open ranges for a property from `from` onwards (for calendars). */
export async function getUnavailableRanges(prisma: PrismaClient, propertyId: string, from: string) {
  const start = parseDate(from);
  const [bookings, blocks] = await Promise.all([
    prisma.booking.findMany({
      where: { propertyId, status: { in: ACTIVE_BOOKING_STATUSES }, checkOut: { gt: start } },
      select: { checkIn: true, checkOut: true },
    }),
    prisma.availabilityBlock.findMany({
      where: { propertyId, endDate: { gt: start } },
      select: { startDate: true, endDate: true },
    }),
  ]);
  return [
    ...bookings.map((b) => ({ start: toIso(b.checkIn), end: toIso(b.checkOut), kind: "booked" as const })),
    ...blocks.map((b) => ({ start: toIso(b.startDate), end: toIso(b.endDate), kind: "blocked" as const })),
  ];
}
