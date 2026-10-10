import "server-only";
import { cookies } from "next/headers";
import {
  addDeviceBooking,
  bookingAccessKey,
  parseDeviceBookings,
  serialiseDeviceBookings,
  verifyBookingAccessKey,
  type DeviceBooking,
} from "./booking-access";
import { bookingActorFor, type BookingActor } from "./booking-rules";
import { getCurrentUser, type SessionUser } from "./session";

const COOKIE = "havora_bookings";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 400;

function secret(): string {
  const value = process.env.BETTER_AUTH_SECRET;
  if (!value) throw new Error("BETTER_AUTH_SECRET is not configured.");
  return value;
}

export function appBaseUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.BETTER_AUTH_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
  return url.replace(/\/+$/, "");
}

type AccessTarget = { id: string; reference: string; accessVersion: number };

export function accessKeyFor(booking: AccessTarget): string {
  return bookingAccessKey(secret(), booking.id, booking.accessVersion);
}

export function isValidAccessKey(booking: AccessTarget, key: unknown): boolean {
  return verifyBookingAccessKey(secret(), booking.id, booking.accessVersion, key);
}

/**
 * The private link sent to guests. The key travels in the URL fragment (#…),
 * which browsers never send to the server, so it stays out of request logs and
 * referrer headers. The /booking/open page exchanges it for an HttpOnly cookie.
 */
export function privateBookingLink(booking: AccessTarget): string {
  return `${appBaseUrl()}/booking/open#${booking.reference}.${accessKeyFor(booking)}`;
}

/** Bookings this browser has proven access to (read-only; usable while rendering). */
export async function readDeviceBookings(): Promise<DeviceBooking[]> {
  return parseDeviceBookings((await cookies()).get(COOKIE)?.value);
}

/** Remembers a booking on this device. Only callable from server actions / route handlers. */
export async function rememberDeviceBooking(booking: AccessTarget): Promise<void> {
  const store = await cookies();
  const entries = addDeviceBooking(parseDeviceBookings(store.get(COOKIE)?.value), {
    reference: booking.reference,
    key: accessKeyFor(booking),
  });
  store.set(COOKIE, serialiseDeviceBookings(entries), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export type BookingAccess = { actor: BookingActor; user: SessionUser | null; viaGuestKey: boolean };

type AccessBooking = AccessTarget & { customerId: string | null; property: { ownerId: string } };

/**
 * Decides who the current visitor is for a booking:
 *  - the property's owner or an administrator (signed in),
 *  - the legacy customer account the booking is linked to (signed in),
 *  - a guest whose browser holds a valid private access key.
 * Returns null for everyone else — a reference number alone grants nothing.
 */
export async function resolveBookingAccess(booking: AccessBooking): Promise<BookingAccess | null> {
  const user = await getCurrentUser();
  const sessionActor = user ? bookingActorFor(user, booking) : null;
  if (sessionActor) return { actor: sessionActor, user, viaGuestKey: false };

  const entry = (await readDeviceBookings()).find((item) => item.reference === booking.reference);
  if (entry && isValidAccessKey(booking, entry.key)) return { actor: "CUSTOMER", user, viaGuestKey: true };
  return null;
}
