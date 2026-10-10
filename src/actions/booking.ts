"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import type { BookingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { safely, TOO_MANY } from "@/lib/action-utils";
import { normaliseReference, publicGuestName } from "@/lib/booking-access";
import { customerCancellation } from "@/lib/booking-rules";
import { assertWithinBookingCap, createBooking, transitionBooking } from "@/lib/bookings";
import { toIso, todayIn } from "@/lib/dates";
import { emailConfigured } from "@/lib/email";
import { isValidAccessKey, rememberDeviceBooking, resolveBookingAccess } from "@/lib/guest-access";
import { notifyBookingCreated, notifyBookingStatusChanged, sendBookingAccessLink } from "@/lib/notifications";
import { rateLimit, rateLimitByIp } from "@/lib/rate-limit";
import { refreshRating } from "@/lib/reviews";
import { AuthorizationError, getCurrentUser } from "@/lib/session";
import {
  bookingLookupSchema,
  bookingSchema,
  formToObject,
  invalid,
  parseLines,
  reasonSchema,
  reviewSchema,
  type FormState,
} from "@/lib/validation";

/**
 * Guest checkout. No account is needed: the booking is tied to the contact
 * details entered here and to a private access key remembered by this browser.
 * A signed-in user (host, admin or legacy customer) has the booking linked to
 * their account as well.
 */
export async function createBookingAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return safely(async () => {
    // Honeypot: real visitors never see or fill this field.
    if (formData.get("company")) return { ok: false, message: "Something went wrong on our side. Please try again." };

    const parsed = bookingSchema.safeParse(formToObject(formData));
    if (!parsed.success) return invalid(parsed.error);
    const { additionalGuests, ...data } = parsed.data;

    // Abuse limits: per connection and per email address.
    if (!(await rateLimitByIp("booking-hour", 6, 3600)) || !(await rateLimitByIp("booking-day", 15, 86_400))) return TOO_MANY;
    if (!(await rateLimit(`booking-email:${data.contactEmail}`, 6, 86_400))) return TOO_MANY;

    const user = await getCurrentUser();
    const existing = await prisma.booking.findUnique({ where: { idempotencyKey: data.idempotencyKey }, select: { id: true } });
    if (!existing) await assertWithinBookingCap(prisma, data.contactEmail);

    const booking = await createBooking(prisma, {
      ...data,
      customerId: user?.id ?? null,
      additionalGuests: parseLines(additionalGuests, 29),
    });

    await rememberDeviceBooking(booking);
    // Only a brand-new booking sends email; a retried submission does not send it twice.
    // The booking is already saved at this point: an email problem never undoes it.
    const mail = existing ? null : await notifyBookingCreated(booking);
    if (mail === "failed") {
      await prisma.auditLog.create({
        data: { actorId: null, action: "email.failed", entityType: "Booking", entityId: booking.id, metadata: { reference: booking.reference, kind: "booking confirmation" } },
      });
    }

    revalidatePath("/", "layout");
    // The confirmation page states what really happened to the email (sent / failed / off).
    redirect(`/booking/${booking.reference}?new=1${mail ? `&mail=${mail}` : ""}`);
  });
}

/**
 * Loads a booking the current visitor may act on, with the role they hold for
 * it. "Missing" and "not yours" are indistinguishable so ids cannot be probed.
 */
async function loadBookingForAction(bookingId: unknown) {
  if (typeof bookingId !== "string" || !bookingId || bookingId.length > 40) throw new AuthorizationError("Booking not found.");
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { property: { select: { ownerId: true, timezone: true } }, payments: true, review: { select: { id: true } } },
  });
  const access = booking ? await resolveBookingAccess(booking) : null;
  if (!booking || !access) throw new AuthorizationError("Booking not found.");
  return { ...access, booking, today: todayIn(booking.property.timezone) };
}

export async function cancelBookingAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return safely(async () => {
    const { user, booking, actor, today } = await loadBookingForAction(formData.get("bookingId"));
    if (!(await rateLimitByIp("booking-manage", 30, 3600))) return TOO_MANY;
    const parsed = reasonSchema.safeParse(formToObject(formData));
    if (!parsed.success) return invalid(parsed.error);
    const reason = parsed.data.reason;

    let to: BookingStatus = "CANCELLED";
    if (actor === "CUSTOMER") {
      const option = customerCancellation(
        { status: booking.status, checkIn: toIso(booking.checkIn), cancellationPolicy: booking.cancellationPolicy },
        today,
      );
      if (option.kind === "none") return { ok: false, message: "This booking can no longer be cancelled online. Please contact the host." };
      if (option.kind === "request") to = "CANCELLATION_REQUESTED";
    }

    const updated = await transitionBooking(prisma, { bookingId: booking.id, to, actor, actorId: user?.id ?? null, reason });
    await notifyBookingStatusChanged(updated, actor === "CUSTOMER" ? "GUEST" : "HOST");
    revalidatePath("/", "layout");
    return {
      ok: true,
      message:
        to === "CANCELLED"
          ? "The booking has been cancelled."
          : "Your cancellation request has been sent to the host for review.",
    };
  });
}

const DECISIONS: Record<string, { from: BookingStatus[]; to: BookingStatus; done: string }> = {
  confirm: { from: ["PENDING"], to: "CONFIRMED", done: "Booking confirmed." },
  decline: { from: ["PENDING"], to: "DECLINED", done: "Booking declined." },
  approve_cancellation: { from: ["CANCELLATION_REQUESTED"], to: "CANCELLED", done: "Cancellation approved." },
  reject_cancellation: { from: ["CANCELLATION_REQUESTED"], to: "CONFIRMED", done: "Cancellation request declined — the booking stays confirmed." },
  complete: { from: ["CONFIRMED"], to: "COMPLETED", done: "Stay marked as completed." },
  no_show: { from: ["CONFIRMED"], to: "NO_SHOW", done: "Booking marked as a no-show." },
};

/** Host / administrator decisions on a booking. */
export async function bookingDecisionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return safely(async () => {
    const { user, booking, actor, today } = await loadBookingForAction(formData.get("bookingId"));
    if (actor === "CUSTOMER" || !user) throw new AuthorizationError();

    const decision = DECISIONS[String(formData.get("decision"))];
    if (!decision || !decision.from.includes(booking.status)) {
      return { ok: false, message: "That action is not available for this booking." };
    }
    if (decision.to === "COMPLETED" && today < toIso(booking.checkOut)) {
      return { ok: false, message: "A stay can be completed on or after its check-out date." };
    }
    if (decision.to === "NO_SHOW" && today < toIso(booking.checkIn)) {
      return { ok: false, message: "A no-show can only be recorded from the check-in date." };
    }

    const parsed = reasonSchema.safeParse(formToObject(formData));
    const updated = await transitionBooking(prisma, {
      bookingId: booking.id,
      to: decision.to,
      actor,
      actorId: user.id,
      reason: parsed.success ? parsed.data.reason : undefined,
    });
    if (decision.to !== "COMPLETED" && decision.to !== "NO_SHOW") await notifyBookingStatusChanged(updated, "HOST");
    revalidatePath("/", "layout");
    return { ok: true, message: decision.done };
  });
}

/**
 * The host (or an administrator) records that the guest actually paid at the
 * property. This is the only way a Pay at Property payment becomes PAID.
 */
export async function recordPaymentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return safely(async () => {
    const { user, booking, actor, today } = await loadBookingForAction(formData.get("bookingId"));
    if (actor === "CUSTOMER" || !user) throw new AuthorizationError();

    const payment = booking.payments.find((p) => p.status === "UNPAID" && p.method === "PAY_AT_PROPERTY");
    if (!payment) return { ok: false, message: "There is no outstanding payment for this booking." };
    if (booking.status !== "CONFIRMED" && booking.status !== "COMPLETED") {
      return { ok: false, message: "Payment can only be recorded for confirmed or completed stays." };
    }
    if (today < toIso(booking.checkIn)) {
      return { ok: false, message: "Payment at the property can be recorded from the check-in date." };
    }

    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: { status: "PAID", paidAt: new Date(), recordedById: user.id, note: "Collected at property" },
      }),
      prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: "payment.recorded",
          entityType: "Payment",
          entityId: payment.id,
          metadata: { reference: booking.reference, amountCents: payment.amountCents, as: actor },
        },
      }),
    ]);
    revalidatePath("/", "layout");
    return { ok: true, message: "Payment recorded as collected at the property." };
  });
}

/**
 * Reviews come only from the person who made the booking (guest key or linked
 * account), only for completed stays, and only once per stay.
 */
export async function submitReviewAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return safely(async () => {
    const parsed = reviewSchema.safeParse(formToObject(formData));
    if (!parsed.success) return invalid(parsed.error);
    const { bookingId, rating, comment } = parsed.data;

    const { user, booking, actor } = await loadBookingForAction(bookingId);
    if (actor !== "CUSTOMER") throw new AuthorizationError("Only the guest who stayed can review this booking.");
    if (!(await rateLimitByIp("review", 10, 3600))) return TOO_MANY;
    if (booking.status !== "COMPLETED") return { ok: false, message: "You can review a stay once it has been completed." };
    if (booking.review) return { ok: false, message: "This stay has already been reviewed." };

    // Linked to the account only when the reviewer is that account holder; guests are stored by display name.
    const linkedAuthorId = user && booking.customerId === user.id ? user.id : null;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.review.create({
          data: {
            bookingId,
            propertyId: booking.propertyId,
            authorId: linkedAuthorId,
            authorName: publicGuestName(booking.contactName),
            rating,
            comment,
          },
        });
        await refreshRating(tx, booking.propertyId);
      });
    } catch (error) {
      // The unique index on Review.bookingId is the final guard against duplicates.
      if ((error as { code?: string }).code === "P2002") return { ok: false, message: "This stay has already been reviewed." };
      throw error;
    }
    revalidatePath("/", "layout");
    return { ok: true, message: "Thank you — your review has been published." };
  });
}

const LOOKUP_REPLY: FormState = {
  ok: true,
  message: "If those details match a booking, a private link is being sent to that address. Please check your inbox (and spam folder). If nothing arrives within a few minutes, contact our support team.",
};

/**
 * "Find my booking": never reveals whether a reference or email exists and
 * never grants access directly — it only emails a private link to the address
 * already stored on the booking.
 */
export async function requestBookingLinkAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return safely(async () => {
    const parsed = bookingLookupSchema.safeParse(formToObject(formData));
    if (!parsed.success) return invalid(parsed.error);
    const reference = normaliseReference(parsed.data.reference);

    // Whether email works at all is not information about any booking, so it is safe to say so.
    if (!emailConfigured()) {
      return { ok: false, message: "We can't email booking links at the moment. Please contact our support team with your booking reference." };
    }
    if (!(await rateLimitByIp("booking-lookup", 6, 900))) return TOO_MANY;
    if (reference && !(await rateLimit(`booking-lookup-ref:${reference}`, 5, 3600))) return LOOKUP_REPLY;
    if (!(await rateLimit(`booking-lookup-email:${parsed.data.email}`, 5, 3600))) return LOOKUP_REPLY;

    if (reference) {
      const booking = await prisma.booking.findUnique({ where: { reference } });
      if (booking && booking.contactEmail === parsed.data.email) {
        // Sent after the reply has gone out, so a matching reference + email does not
        // take measurably longer to answer than a non-matching one.
        after(async () => {
          const result = await sendBookingAccessLink(booking);
          if (result !== "sent") {
            await prisma.auditLog
              .create({
                data: { actorId: null, action: "email.failed", entityType: "Booking", entityId: booking.id, metadata: { reference: booking.reference, kind: "booking link recovery" } },
              })
              .catch((error) => console.error("[booking] could not record a failed recovery email", error));
          }
        });
      }
    }
    return LOOKUP_REPLY;
  });
}

export type OpenBookingResult = { ok: true; reference: string } | { ok: false };

/**
 * Exchanges a private link (reference + key from the URL fragment) for an
 * HttpOnly cookie on this device. Wrong keys and unknown references look identical.
 */
export async function openBookingAction(reference: string, key: string): Promise<OpenBookingResult> {
  try {
    if (!(await rateLimitByIp("booking-open", 20, 900))) return { ok: false };
    const normalised = normaliseReference(reference);
    if (!normalised || typeof key !== "string") return { ok: false };
    const booking = await prisma.booking.findUnique({ where: { reference: normalised }, select: { id: true, reference: true, accessVersion: true } });
    if (!booking || !isValidAccessKey(booking, key)) return { ok: false };
    await rememberDeviceBooking(booking);
    return { ok: true, reference: booking.reference };
  } catch (error) {
    console.error("[booking] open link failed", error);
    return { ok: false };
  }
}

/**
 * Administrator-only: revokes every private link issued for a booking (for
 * example if a guest reports that theirs was shared) and emails a new one to
 * the address on the booking.
 */
export async function resetBookingLinkAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return safely(async () => {
    const { user, booking, actor } = await loadBookingForAction(formData.get("bookingId"));
    if (actor !== "ADMIN" || !user) throw new AuthorizationError();

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.booking.update({ where: { id: booking.id }, data: { accessVersion: { increment: 1 } } });
      await tx.auditLog.create({
        data: { actorId: user.id, action: "booking.link_reset", entityType: "Booking", entityId: booking.id, metadata: { reference: booking.reference } },
      });
      return next;
    });
    const result = await sendBookingAccessLink(updated);
    revalidatePath("/", "layout");
    return result === "sent"
      ? { ok: true, message: "Previous private links no longer work. A new link has been emailed to the guest." }
      : {
          ok: false,
          message:
            result === "off"
              ? "Previous private links no longer work, but email is not configured, so NO new link was sent. The guest cannot open this booking until a link reaches them."
              : "Previous private links no longer work, but the email with the new link FAILED to send. Try again, or contact the guest directly.",
        };
  });
}
