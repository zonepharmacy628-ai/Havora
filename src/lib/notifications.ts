import "server-only";
import type { Booking } from "@prisma/client";
import { BOOKING_STATUS_LABEL, CANCELLATION_POLICIES } from "./constants";
import { formatDate, toIso } from "./dates";
import { sendEmailWithResult, type EmailResult } from "./email";
import { appBaseUrl, privateBookingLink } from "./guest-access";
import { formatMoney } from "./money";
import { prisma } from "./prisma";

// Transactional booking emails. Every function is best-effort: a mail provider
// problem must never fail or roll back a booking, so errors are logged and swallowed.
// Private booking links are only ever sent to the email address on the booking.

type Stay = Pick<
  Booking,
  "id" | "reference" | "accessVersion" | "propertyId" | "checkIn" | "checkOut" | "nights" | "adults" | "children" | "totalCents" | "currency" | "status" | "contactName" | "contactEmail" | "cancellationPolicy"
>;

async function context(booking: Stay) {
  const property = await prisma.property.findUnique({
    where: { id: booking.propertyId },
    select: { title: true, city: true, country: true, checkInFrom: true, checkOutBy: true, owner: { select: { name: true, email: true } } },
  });
  return property;
}

function summary(booking: Stay, property: NonNullable<Awaited<ReturnType<typeof context>>>): string {
  const guests = booking.adults + booking.children;
  return [
    `Booking reference: ${booking.reference}`,
    `Property: ${property.title} — ${property.city}, ${property.country}`,
    `Check-in: ${formatDate(toIso(booking.checkIn), { weekday: true })} (from ${property.checkInFrom})`,
    `Check-out: ${formatDate(toIso(booking.checkOut), { weekday: true })} (by ${property.checkOutBy})`,
    `Guests: ${guests} · Nights: ${booking.nights}`,
    `Total: ${formatMoney(booking.totalCents, booking.currency)} — payable at the property. Nothing has been charged online.`,
  ].join("\n");
}

async function safeSend(to: string, subject: string, text: string): Promise<EmailResult> {
  try {
    return await sendEmailWithResult({ to, subject, text });
  } catch (error) {
    console.error(`[email] "${subject}" failed`, error instanceof Error ? error.name : "error");
    return "failed";
  }
}

const SIGN_OFF = "\n\n— HAVORA";

/**
 * To the guest and the host, right after a booking is created.
 * Returns what happened to the GUEST's confirmation email, so the confirmation
 * page can say truthfully whether it was sent.
 */
export async function notifyBookingCreated(booking: Stay): Promise<EmailResult> {
  const property = await context(booking);
  if (!property) return "failed";
  const confirmed = booking.status === "CONFIRMED";
  const policy = CANCELLATION_POLICIES[booking.cancellationPolicy];

  const guestResult = await safeSend(
    booking.contactEmail,
    confirmed ? `Your HAVORA booking is confirmed — ${booking.reference}` : `We've received your booking request — ${booking.reference}`,
    [
      `Hello ${booking.contactName},`,
      "",
      confirmed
        ? "Your stay is confirmed. Here are the details:"
        : "Your request has been sent to the host, who will confirm or decline it. Here are the details:",
      "",
      summary(booking, property),
      "",
      `Cancellation: ${policy.label} — ${policy.summary}`,
      "",
      "View, manage or cancel your booking with your private link (keep it safe and do not share it):",
      privateBookingLink(booking),
    ].join("\n") + SIGN_OFF,
  );

  await safeSend(
    property.owner.email,
    confirmed ? `New booking for ${property.title} — ${booking.reference}` : `New booking request for ${property.title} — ${booking.reference}`,
    [
      `Hello ${property.owner.name},`,
      "",
      confirmed ? "You have a new confirmed booking." : "You have a new booking request waiting for your decision.",
      "",
      summary(booking, property),
      `Lead guest: ${booking.contactName}`,
      "",
      `Open it in your dashboard: ${appBaseUrl()}/booking/${booking.reference}`,
    ].join("\n") + SIGN_OFF,
  );
  return guestResult;
}

/** A fresh private link, requested through "Find my booking". Returns the delivery result. */
export async function sendBookingAccessLink(booking: Stay): Promise<EmailResult> {
  const property = await context(booking);
  if (!property) return "failed";
  return safeSend(
    booking.contactEmail,
    `Your HAVORA booking link — ${booking.reference}`,
    [
      `Hello ${booking.contactName},`,
      "",
      "Someone asked for a link to this booking. If that was you, open it here:",
      privateBookingLink(booking),
      "",
      summary(booking, property),
      "",
      "If you did not request this, you can ignore this email — your booking is unchanged.",
    ].join("\n") + SIGN_OFF,
  );
}

/** To the guest and/or host when a booking's status changes. */
export async function notifyBookingStatusChanged(booking: Stay, changedBy: "GUEST" | "HOST"): Promise<void> {
  const property = await context(booking);
  if (!property) return;
  const label = BOOKING_STATUS_LABEL[booking.status];

  if (changedBy === "HOST") {
    await safeSend(
      booking.contactEmail,
      `Update on your HAVORA booking ${booking.reference}: ${label}`,
      [
        `Hello ${booking.contactName},`,
        "",
        `The status of your booking is now: ${label}.`,
        "",
        summary(booking, property),
        "",
        "View your booking:",
        privateBookingLink(booking),
      ].join("\n") + SIGN_OFF,
    );
  } else {
    await safeSend(
      property.owner.email,
      `Booking ${booking.reference} for ${property.title}: ${label}`,
      [
        `Hello ${property.owner.name},`,
        "",
        booking.status === "CANCELLATION_REQUESTED"
          ? "The guest has asked to cancel this booking. Please approve or decline the request."
          : `The guest has changed this booking. Its status is now: ${label}.`,
        "",
        summary(booking, property),
        "",
        `Open it in your dashboard: ${appBaseUrl()}/booking/${booking.reference}`,
      ].join("\n") + SIGN_OFF,
    );
  }
}
