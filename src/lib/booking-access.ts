import { createHmac, timingSafeEqual } from "node:crypto";

// Private booking links for guests.
//
// A booking reference (HV-XXXXXXXX) is an identifier, not a password. Guests
// prove a booking is theirs with an access key: an HMAC-SHA256 over the booking
// id and its access version, signed with a server-side secret. The key has 256
// bits of entropy, is never stored in the database, and can be revoked by
// increasing `Booking.accessVersion`.

const CONTEXT = "havora:booking-access:v1";

export function bookingAccessKey(secret: string, bookingId: string, accessVersion: number): string {
  if (!secret || secret.length < 16) throw new Error("A server secret of at least 16 characters is required to sign booking links.");
  return createHmac("sha256", secret).update(`${CONTEXT}:${bookingId}:${accessVersion}`).digest("base64url");
}

export function verifyBookingAccessKey(secret: string, bookingId: string, accessVersion: number, key: unknown): boolean {
  if (typeof key !== "string" || key.length < 20 || key.length > 100) return false;
  const expected = Buffer.from(bookingAccessKey(secret, bookingId, accessVersion));
  const given = Buffer.from(key);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

const REFERENCE = /^HV-[A-HJ-NP-Z2-9]{8}$/;

export function normaliseReference(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim().toUpperCase().replace(/\s+/g, "");
  const withPrefix = value.startsWith("HV-") ? value : value.startsWith("HV") ? `HV-${value.slice(2)}` : `HV-${value}`;
  return REFERENCE.test(withPrefix) ? withPrefix : null;
}

export type DeviceBooking = { reference: string; key: string };

const MAX_DEVICE_BOOKINGS = 12;

/** Cookie format: "REF.key,REF.key" — newest first, capped. */
export function parseDeviceBookings(raw: string | undefined | null): DeviceBooking[] {
  if (!raw) return [];
  const out: DeviceBooking[] = [];
  for (const part of raw.split(",").slice(0, MAX_DEVICE_BOOKINGS)) {
    const dot = part.indexOf(".");
    if (dot === -1) continue;
    const reference = normaliseReference(part.slice(0, dot));
    const key = part.slice(dot + 1);
    if (reference && /^[A-Za-z0-9_-]{20,100}$/.test(key) && !out.some((entry) => entry.reference === reference)) {
      out.push({ reference, key });
    }
  }
  return out;
}

export function serialiseDeviceBookings(entries: DeviceBooking[]): string {
  return entries
    .slice(0, MAX_DEVICE_BOOKINGS)
    .map((entry) => `${entry.reference}.${entry.key}`)
    .join(",");
}

export function addDeviceBooking(entries: DeviceBooking[], entry: DeviceBooking): DeviceBooking[] {
  return [entry, ...entries.filter((existing) => existing.reference !== entry.reference)].slice(0, MAX_DEVICE_BOOKINGS);
}

/** "Jane Doe" → "Jane D." — the only form of a guest's name shown publicly. */
export function publicGuestName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Guest";
  const first = parts[0].slice(0, 30);
  const lastInitial = parts.length > 1 ? ` ${parts[parts.length - 1][0].toUpperCase()}.` : "";
  return `${first}${lastInitial}`;
}
