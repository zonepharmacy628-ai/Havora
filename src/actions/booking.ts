"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { BookingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { safely, TOO_MANY } from "@/lib/action-utils";
import { bookingActorFor, customerCancellation } from "@/lib/booking-rules";
import { createBooking, transitionBooking } from "@/lib/bookings";
import { toIso, todayIn } from "@/lib/dates";
import { rateLimit } from "@/lib/rate-limit";
import { refreshRating } from "@/lib/reviews";
import { assertUser, AuthorizationError } from "@/lib/session";
import { bookingSchema, formToObject, invalid, parseLines, reasonSchema, reviewSchema, type FormState } from "@/lib/validation";

export async function createBookingAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return safely(async () => {
    const user = await assertUser();
    const parsed = bookingSchema.safeParse(formToObject(formData));
    if (!parsed.success) return invalid(parsed.error);
    if (!(await rateLimit(`booking:${user.id}`, 10, 3600))) return TOO_MANY;

    const { additionalGuests, ...data } = parsed.data;
    const booking = await createBooking(prisma, {
      ...data,
      customerId: user.id,
      additionalGuests: parseLines(additionalGuests, 29),
    });

    revalidatePath("/", "layout");
    redirect(`/booking/${booking.reference}?new=1`);
  });
}

/** Loads a booking the current user is allowed to act on, with their role for it. */
async function loadBookingForAction(bookingId: unknown) {
  const user = await assertUser();
  if (typeof bookingId !== "string" || !bookingId) throw new AuthorizationError("Booking not found.");
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { property: { select: { ownerId: true, timezone: true } }, payments: true },
  });
  const actor = booking ? bookingActorFor(user, booking) : null;
  // Same message for "missing" and "not yours" so booking ids cannot be probed.
  if (!booking || !actor) throw new AuthorizationError("Booking not found.");
  return { user, booking, actor, today: todayIn(booking.property.timezone) };
}

export async function cancelBookingAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return safely(async () => {
    const { user, booking, actor, today } = await loadBookingForAction(formData.get("bookingId"));
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

    await transitionBooking(prisma, { bookingId: booking.id, to, actor, actorId: user.id, reason });
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
    if (actor === "CUSTOMER") throw new AuthorizationError();

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
    await transitionBooking(prisma, {
      bookingId: booking.id,
      to: decision.to,
      actor,
      actorId: user.id,
      reason: parsed.success ? parsed.data.reason : undefined,
    });
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
    if (actor === "CUSTOMER") throw new AuthorizationError();

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

export async function submitReviewAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return safely(async () => {
    const user = await assertUser();
    const parsed = reviewSchema.safeParse(formToObject(formData));
    if (!parsed.success) return invalid(parsed.error);
    const { bookingId, rating, comment } = parsed.data;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, customerId: true, propertyId: true, status: true, review: { select: { id: true } } },
    });
    if (!booking || booking.customerId !== user.id) throw new AuthorizationError("Booking not found.");
    if (booking.status !== "COMPLETED") return { ok: false, message: "You can review a stay once it has been completed." };
    if (booking.review) return { ok: false, message: "You have already reviewed this stay." };

    await prisma.$transaction(async (tx) => {
      await tx.review.create({ data: { bookingId, propertyId: booking.propertyId, authorId: user.id, rating, comment } });
      await refreshRating(tx, booking.propertyId);
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "Thank you — your review has been published." };
  });
}
