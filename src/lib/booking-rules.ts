import type { BookingStatus, CancellationPolicy, Role } from "@prisma/client";
import { CANCELLATION_POLICIES } from "./constants";
import { addDays, nightsBetween } from "./dates";

/** Statuses that hold the calendar (no other booking may overlap them). */
export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = ["PENDING", "CONFIRMED", "CANCELLATION_REQUESTED"];

/** Statuses that count towards earnings and revenue reports. */
export const REVENUE_BOOKING_STATUSES: BookingStatus[] = ["CONFIRMED", "CANCELLATION_REQUESTED", "COMPLETED"];

export type BookingActor = "CUSTOMER" | "OWNER" | "ADMIN" | "SYSTEM";

const TRANSITIONS: Record<BookingStatus, Partial<Record<BookingStatus, BookingActor[]>>> = {
  PENDING: {
    CONFIRMED: ["OWNER", "ADMIN"],
    DECLINED: ["OWNER", "ADMIN"],
    CANCELLED: ["CUSTOMER", "ADMIN"],
  },
  CONFIRMED: {
    CANCELLED: ["CUSTOMER", "OWNER", "ADMIN"],
    CANCELLATION_REQUESTED: ["CUSTOMER"],
    COMPLETED: ["OWNER", "ADMIN", "SYSTEM"],
    NO_SHOW: ["OWNER", "ADMIN"],
  },
  CANCELLATION_REQUESTED: {
    CANCELLED: ["OWNER", "ADMIN"],
    CONFIRMED: ["OWNER", "ADMIN"],
  },
  DECLINED: {},
  CANCELLED: {},
  COMPLETED: {},
  NO_SHOW: {},
};

export function canTransition(from: BookingStatus, to: BookingStatus, actor: BookingActor): boolean {
  return TRANSITIONS[from][to]?.includes(actor) ?? false;
}

/** Last calendar date (property-local) on which the guest may still cancel without approval. */
export function freeCancellationDeadline(checkIn: string, policy: CancellationPolicy): string {
  return addDays(checkIn, -CANCELLATION_POLICIES[policy].freeDays);
}

export type CustomerCancellation =
  | { kind: "direct"; deadline: string }
  | { kind: "request"; deadline: string }
  | { kind: "none" };

/**
 * What a customer can do about cancelling:
 *  - "direct":  cancel immediately (pending bookings, or inside the free window)
 *  - "request": free window has passed — ask the host, who approves or declines
 *  - "none":    stay already started or booking is no longer active
 */
export function customerCancellation(
  booking: { status: BookingStatus; checkIn: string; cancellationPolicy: CancellationPolicy },
  today: string,
): CustomerCancellation {
  const deadline = freeCancellationDeadline(booking.checkIn, booking.cancellationPolicy);
  if (booking.status === "PENDING") return { kind: "direct", deadline };
  if (booking.status !== "CONFIRMED") return { kind: "none" };
  if (today >= booking.checkIn) return { kind: "none" };
  return today <= deadline ? { kind: "direct", deadline } : { kind: "request", deadline };
}

export type StayValidationInput = {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  today: string;
  property: { maxGuests: number; minNights: number; maxNights: number };
};

/** Returns a human-readable problem, or null when the stay request is acceptable. */
export function validateStay(input: StayValidationInput): string | null {
  const { checkIn, checkOut, adults, children, today, property } = input;
  if (checkIn < today) return "Check-in cannot be in the past.";
  if (checkOut <= checkIn) return "Check-out must be after check-in.";
  if (checkIn > addDays(today, 540)) return "Bookings can be made up to 18 months ahead.";
  const nights = nightsBetween(checkIn, checkOut);
  if (nights < property.minNights) {
    return `This property requires a minimum stay of ${property.minNights} night${property.minNights === 1 ? "" : "s"}.`;
  }
  if (nights > property.maxNights) return `This property allows stays of up to ${property.maxNights} nights.`;
  if (!Number.isInteger(adults) || adults < 1) return "At least one adult is required.";
  if (!Number.isInteger(children) || children < 0) return "Invalid number of children.";
  if (adults + children > property.maxGuests) {
    return `This property sleeps a maximum of ${property.maxGuests} guests.`;
  }
  return null;
}

// ───────────────────────────── Permissions ─────────────────────────────

export type Actor = { id: string; role: Role };

export const isAdmin = (actor: Actor) => actor.role === "ADMIN";

/** Owners manage only their own listings; administrators manage all. */
export function canManageProperty(actor: Actor, property: { ownerId: string }): boolean {
  return isAdmin(actor) || (actor.role === "OWNER" && property.ownerId === actor.id);
}

export function canViewBooking(actor: Actor, booking: { customerId: string; property: { ownerId: string } }): boolean {
  return isAdmin(actor) || booking.customerId === actor.id || canManageProperty(actor, booking.property);
}

/** Which booking-actor hat the user wears for a given booking (null = no access). */
export function bookingActorFor(
  actor: Actor,
  booking: { customerId: string; property: { ownerId: string } },
): BookingActor | null {
  if (isAdmin(actor)) return "ADMIN";
  if (canManageProperty(actor, booking.property)) return "OWNER";
  if (booking.customerId === actor.id) return "CUSTOMER";
  return null;
}
