import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock, Hourglass, MapPin, Phone, Mail, Users, Wallet } from "lucide-react";
import { bookingDecisionAction, cancelBookingAction, recordPaymentAction, resetBookingLinkAction, submitReviewAction } from "@/actions/booking";
import { ActionForm, SelectField, SubmitButton, TextAreaField } from "@/components/forms";
import { PrivateLink } from "@/components/private-link";
import { BookingBadge, Notice, PaymentBadge, Stars } from "@/components/ui";
import { normaliseReference } from "@/lib/booking-access";
import { customerCancellation } from "@/lib/booking-rules";
import { completeFinishedStays } from "@/lib/bookings";
import { CANCELLATION_POLICIES, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/constants";
import { formatDate, formatDateTime, toIso, todayIn } from "@/lib/dates";
import { formatBps, formatMoney } from "@/lib/money";
import { privateBookingLink, resolveBookingAccess } from "@/lib/guest-access";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Booking details", robots: { index: false, follow: false }, referrer: "no-referrer" };

type Props = { params: Promise<{ reference: string }>; searchParams: Promise<{ new?: string; mail?: string }> };

export default async function BookingPage({ params, searchParams }: Props) {
  const [{ reference: rawReference }, query] = await Promise.all([params, searchParams]);
  // Anything that is not a well-formed reference gets the same answer as an unknown one.
  const reference = normaliseReference(rawReference);
  if (!reference) redirect("/bookings?need=1");

  const booking = await prisma.booking.findUnique({
    where: { reference },
    include: {
      property: { include: { images: { orderBy: { position: "asc" }, take: 1 }, owner: { select: { name: true, email: true, phone: true } } } },
      guests: { orderBy: { isPrimary: "desc" } },
      payments: { orderBy: { createdAt: "asc" }, include: { recordedBy: { select: { name: true } } } },
      review: true,
    },
  });
  // A reference number alone opens nothing. Visitors without proof of access get the
  // same redirect whether or not the booking exists, so references cannot be probed.
  const access = booking ? await resolveBookingAccess(booking) : null;
  if (!booking || !access) redirect("/bookings?need=1");
  const { actor, user, viaGuestKey } = access;

  if (booking.status === "CONFIRMED" && (await completeFinishedStays(prisma, { reference })) > 0) {
    redirect(`/booking/${reference}`);
  }

  const { property } = booking;
  const isStaff = actor !== "CUSTOMER";
  const today = todayIn(property.timezone);
  const checkIn = toIso(booking.checkIn);
  const checkOut = toIso(booking.checkOut);
  const money = (cents: number) => formatMoney(cents, booking.currency);
  const payment = booking.payments[0];
  const policy = CANCELLATION_POLICIES[booking.cancellationPolicy];
  const cancellation = customerCancellation({ status: booking.status, checkIn, cancellationPolicy: booking.cancellationPolicy }, today);
  const isActive = booking.status === "PENDING" || booking.status === "CONFIRMED" || booking.status === "CANCELLATION_REQUESTED";
  const backHref = actor === "ADMIN" ? "/admin/bookings" : actor === "OWNER" ? "/owner/bookings" : "/bookings";
  // Guests (and the linked account holder) can copy their private link from this page.
  const privateLink = actor === "CUSTOMER" ? privateBookingLink(booking) : null;
  const cover = property.images[0];

  const banner =
    booking.status === "CONFIRMED"
      ? { icon: CheckCircle2, tone: "bg-emerald-600", title: "Booking confirmed", text: `Your stay is reserved. Payment of ${money(booking.totalCents)} is due at the property on arrival.` }
      : booking.status === "PENDING"
        ? { icon: Hourglass, tone: "bg-amber-600", title: "Request sent", text: "The host will review your request and confirm or decline it. Nothing has been charged." }
        : null;

  const staffDecisions = [
    booking.status === "PENDING" && { value: "confirm", label: "Confirm booking", className: "btn btn-gold" },
    booking.status === "PENDING" && { value: "decline", label: "Decline", className: "btn btn-danger" },
    booking.status === "CANCELLATION_REQUESTED" && { value: "approve_cancellation", label: "Approve cancellation", className: "btn btn-gold" },
    booking.status === "CANCELLATION_REQUESTED" && { value: "reject_cancellation", label: "Keep booking", className: "btn btn-outline" },
    booking.status === "CONFIRMED" && today >= checkOut && { value: "complete", label: "Mark stay completed", className: "btn btn-gold" },
    booking.status === "CONFIRMED" && today >= checkIn && { value: "no_show", label: "Mark as no-show", className: "btn btn-outline" },
  ].filter((d): d is { value: string; label: string; className: string } => Boolean(d));

  const canRecordPayment = isStaff && payment?.status === "UNPAID" && (booking.status === "CONFIRMED" || booking.status === "COMPLETED") && today >= checkIn;

  return (
    <div className="container-page max-w-5xl py-8 sm:py-10">
      <Link href={backHref} className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-gold-700">
        <ArrowLeft className="size-4" aria-hidden="true" /> {isStaff ? "Back to reservations" : "My bookings"}
      </Link>

      {query.new === "1" && banner && actor === "CUSTOMER" && (
        <div className="animate-fade-up mb-6 flex items-start gap-4 rounded-2xl bg-navy-900 p-6 text-white">
          <span className={`flex size-11 shrink-0 items-center justify-center rounded-full ${banner.tone}`}>
            <banner.icon className="size-6" aria-hidden="true" />
          </span>
          <div>
            <h1 className="font-serif text-2xl font-medium">{banner.title}</h1>
            <p className="mt-1 text-sm text-navy-200">{banner.text}</p>
            <p className="mt-2 text-sm">
              Booking reference: <span className="font-semibold tracking-wider text-gold-300">{booking.reference}</span>
            </p>
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Booking reference</p>
          <p className="font-serif text-3xl font-medium tracking-wide text-ink">{booking.reference}</p>
          <p className="mt-1 text-xs text-muted">Booked {formatDateTime(booking.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          <BookingBadge status={booking.status} />
          {payment && <PaymentBadge status={payment.status} />}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="card overflow-hidden">
            <div className="flex flex-col sm:flex-row">
              <div className="relative aspect-[16/10] shrink-0 bg-cream-200 sm:aspect-auto sm:w-56">
                {cover && <Image src={cover.url} alt={cover.alt || property.title} fill sizes="(min-width: 640px) 224px, 100vw" className="object-cover" />}
              </div>
              <div className="p-5">
                <h2 className="font-serif text-xl font-medium text-ink">
                  <Link href={`/properties/${property.slug}`} className="hover:text-gold-700">{property.title}</Link>
                </h2>
                <p className="mt-1 flex items-start gap-1.5 text-sm text-muted">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-gold-600" aria-hidden="true" />
                  {/* The street address is shared only once a booking exists. */}
                  {[property.addressLine, property.city, property.postalCode, property.country].filter(Boolean).join(", ")}
                </p>
                <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="flex items-center gap-1 text-xs text-muted"><CalendarDays className="size-3.5" aria-hidden="true" /> Check-in</dt>
                    <dd className="font-semibold text-ink">{formatDate(checkIn, { weekday: true })}</dd>
                    <dd className="text-xs text-muted">from {property.checkInFrom}</dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1 text-xs text-muted"><CalendarDays className="size-3.5" aria-hidden="true" /> Check-out</dt>
                    <dd className="font-semibold text-ink">{formatDate(checkOut, { weekday: true })}</dd>
                    <dd className="text-xs text-muted">by {property.checkOutBy}</dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1 text-xs text-muted"><Users className="size-3.5" aria-hidden="true" /> Guests</dt>
                    <dd className="font-semibold text-ink">
                      {booking.adults} adult{booking.adults === 1 ? "" : "s"}
                      {booking.children > 0 && `, ${booking.children} child${booking.children === 1 ? "" : "ren"}`}
                    </dd>
                    <dd className="text-xs text-muted">{booking.nights} night{booking.nights === 1 ? "" : "s"}</dd>
                  </div>
                </dl>
                <p className="mt-3 flex items-center gap-1 text-xs text-muted">
                  <Clock className="size-3.5" aria-hidden="true" /> Times are in the property&apos;s local time ({property.timezone.replace(/_/g, " ")}).
                </p>
              </div>
            </div>
          </section>

          <section className="card card-pad">
            <h2 className="mb-4 font-serif text-lg font-medium text-ink">{isStaff ? "Guest details" : "Your details"}</h2>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted">Lead guest</dt>
                <dd className="font-semibold text-ink">{booking.contactName}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Party</dt>
                <dd className="text-ink">{booking.guests.map((guest) => guest.fullName).join(", ")}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-1 text-xs text-muted"><Mail className="size-3.5" aria-hidden="true" /> Email</dt>
                <dd className="break-all text-ink">{booking.contactEmail}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-1 text-xs text-muted"><Phone className="size-3.5" aria-hidden="true" /> Phone</dt>
                <dd className="text-ink">{booking.contactPhone}</dd>
              </div>
              {booking.specialRequests && (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted">Special requests</dt>
                  <dd className="whitespace-pre-line text-ink">{booking.specialRequests}</dd>
                </div>
              )}
            </dl>
            {!isStaff && (booking.status === "CONFIRMED" || booking.status === "COMPLETED") && (
              <div className="mt-5 border-t border-cream-200 pt-4 text-sm">
                <p className="text-xs text-muted">Your host</p>
                <p className="font-semibold text-ink">{property.owner.name}</p>
                <p className="text-muted">
                  {property.owner.email}
                  {property.owner.phone ? ` · ${property.owner.phone}` : ""}
                </p>
              </div>
            )}
          </section>

          {privateLink && (query.new === "1" || viaGuestKey) && <PrivateLink link={privateLink} mail={query.new === "1" && (query.mail === "sent" || query.mail === "failed" || query.mail === "off") ? query.mail : null} email={booking.contactEmail} />}

          {booking.cancellationReason && (
            <Notice tone="warning">
              <strong>{booking.status === "DECLINED" ? "Reason for declining" : "Cancellation note"}:</strong> {booking.cancellationReason}
            </Notice>
          )}

          {/* ───── Customer: review a completed stay ───── */}
          {actor === "CUSTOMER" && booking.status === "COMPLETED" && (
            <section className="card card-pad">
              <h2 className="mb-1 font-serif text-lg font-medium text-ink">{booking.review ? "Your review" : "Review your stay"}</h2>
              {booking.review ? (
                <div>
                  <Stars rating={booking.review.rating} />
                  <p className="mt-2 text-sm leading-6 text-muted">{booking.review.comment}</p>
                  {booking.review.status === "HIDDEN" && <p className="mt-2 text-xs font-medium text-red-600">This review has been hidden by a moderator.</p>}
                </div>
              ) : (
                <ActionForm action={submitReviewAction} className="mt-3 space-y-4">
                  <input type="hidden" name="bookingId" value={booking.id} />
                  <SelectField name="rating" label="Overall rating" defaultValue="5" className="max-w-52">
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>
                        {n} star{n === 1 ? "" : "s"}
                      </option>
                    ))}
                  </SelectField>
                  <TextAreaField name="comment" label="Your review" rows={4} placeholder="What did you love? What could be better?" minLength={10} maxLength={2000} required />
                  <SubmitButton>Publish review</SubmitButton>
                </ActionForm>
              )}
            </section>
          )}

          {/* ───── Host / admin actions ───── */}
          {isStaff && (staffDecisions.length > 0 || canRecordPayment || booking.status === "CONFIRMED") && (
            <section className="card card-pad">
              <h2 className="mb-1 font-serif text-lg font-medium text-ink">Manage booking</h2>
              <p className="mb-4 text-xs text-muted">You are signed in as {user?.name} and acting as {actor === "ADMIN" ? "an administrator" : "the host"}. Every action is recorded in the audit log.</p>
              <div className="space-y-5">
                {staffDecisions.length > 0 && (
                  <ActionForm action={bookingDecisionAction}>
                    <input type="hidden" name="bookingId" value={booking.id} />
                    {booking.status === "PENDING" && (
                      <TextAreaField name="reason" label="Message to guest (optional — shown if you decline)" rows={2} maxLength={500} className="mb-3" />
                    )}
                    <div className="flex flex-wrap gap-2">
                      {staffDecisions.map((decision) => (
                        <SubmitButton key={decision.value} name="decision" value={decision.value} className={decision.className}>
                          {decision.label}
                        </SubmitButton>
                      ))}
                    </div>
                  </ActionForm>
                )}
                {canRecordPayment && (
                  <ActionForm action={recordPaymentAction} confirm={`Confirm that ${money(payment.amountCents)} was collected from the guest at the property?`} className="border-t border-cream-200 pt-5">
                    <input type="hidden" name="bookingId" value={booking.id} />
                    <p className="mb-3 text-sm text-muted">Once the guest has paid you at the property, record it here so the booking shows as paid.</p>
                    <SubmitButton className="btn btn-navy">
                      <Wallet className="size-4" aria-hidden="true" /> Record {money(payment.amountCents)} collected
                    </SubmitButton>
                  </ActionForm>
                )}
                {booking.status === "CONFIRMED" && today < checkOut && (
                  <ActionForm action={cancelBookingAction} confirm="Cancel this confirmed booking? The guest will see it as cancelled." className="border-t border-cream-200 pt-5">
                    <input type="hidden" name="bookingId" value={booking.id} />
                    <TextAreaField name="reason" label="Cancel this booking — reason for the guest" rows={2} maxLength={500} className="mb-3" />
                    <SubmitButton className="btn btn-danger">Cancel booking</SubmitButton>
                  </ActionForm>
                )}
              </div>
            </section>
          )}

          {actor === "ADMIN" && (
            <section className="card card-pad">
              <h2 className="mb-1 font-serif text-lg font-medium text-ink">Guest access</h2>
              <p className="mb-4 text-sm text-muted">
                {booking.customerId ? "This booking is linked to a customer account and also has a private guest link." : "This is a guest booking, opened with a private link."} If the guest reports that their link was shared, reset it: old links stop working and a new one is emailed to {booking.contactEmail}.
              </p>
              <ActionForm action={resetBookingLinkAction} confirm="Reset the private link for this booking? Any link the guest already has will stop working." messagePosition="bottom">
                <input type="hidden" name="bookingId" value={booking.id} />
                <SubmitButton className="btn btn-outline">Reset private link</SubmitButton>
              </ActionForm>
            </section>
          )}

          {/* ───── Customer cancellation ───── */}
          {actor === "CUSTOMER" && isActive && (
            <section className="card card-pad">
              <h2 className="mb-1 font-serif text-lg font-medium text-ink">Cancellation</h2>
              <p className="text-sm text-muted">
                <strong className="text-ink">{policy.label} policy.</strong> {policy.summary}
              </p>
              {booking.status === "CANCELLATION_REQUESTED" ? (
                <div className="mt-4">
                  <Notice tone="warning">Your cancellation request is with the host. You will see the outcome here.</Notice>
                </div>
              ) : cancellation.kind === "none" ? (
                <p className="mt-3 text-sm text-muted">This stay has started, so it can no longer be cancelled online. Please contact your host.</p>
              ) : (
                <ActionForm
                  action={cancelBookingAction}
                  confirm={cancellation.kind === "direct" ? "Cancel this booking? This cannot be undone." : "Send a cancellation request to the host?"}
                  className="mt-4"
                >
                  <input type="hidden" name="bookingId" value={booking.id} />
                  <p className="mb-3 text-sm text-ink">
                    {cancellation.kind === "direct"
                      ? booking.status === "PENDING"
                        ? "This request has not been confirmed yet, so you can withdraw it at any time."
                        : `You can cancel free of charge until ${formatDate(cancellation.deadline)}.`
                      : `Free cancellation ended on ${formatDate(cancellation.deadline)}. You can still ask the host to cancel — they will approve or decline your request.`}
                  </p>
                  <TextAreaField name="reason" label="Reason (optional)" rows={2} maxLength={500} className="mb-3" />
                  <SubmitButton className="btn btn-danger">{cancellation.kind === "direct" ? "Cancel booking" : "Request cancellation"}</SubmitButton>
                </ActionForm>
              )}
            </section>
          )}
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <section className="card card-pad">
            <h2 className="mb-4 font-serif text-lg font-medium text-ink">Price Breakdown</h2>
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">{money(booking.nightlyPriceCents)} × {booking.nights} night{booking.nights === 1 ? "" : "s"}</dt>
                <dd className="text-ink">{money(booking.subtotalCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Cleaning fee</dt>
                <dd className="text-ink">{money(booking.cleaningFeeCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Service fee</dt>
                <dd className="text-ink">{money(booking.serviceFeeCents)}</dd>
              </div>
              <div className="flex justify-between border-t border-cream-200 pt-3 text-base font-semibold text-ink">
                <dt>Total</dt>
                <dd className="font-serif text-xl">{money(booking.totalCents)}</dd>
              </div>
            </dl>
            {isStaff && (
              <dl className="mt-4 space-y-2 rounded-xl bg-cream-100 p-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">Platform commission ({formatBps(booking.commissionRateBps)})</dt>
                  <dd className="text-ink">− {money(booking.commissionCents)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Guest service fee (to platform)</dt>
                  <dd className="text-ink">− {money(booking.serviceFeeCents)}</dd>
                </div>
                <div className="flex justify-between border-t border-cream-300 pt-2 font-semibold text-ink">
                  <dt>Host earnings</dt>
                  <dd>{money(booking.ownerEarningsCents)}</dd>
                </div>
              </dl>
            )}
          </section>

          {payment && (
            <section className="card card-pad">
              <h2 className="mb-4 font-serif text-lg font-medium text-ink">Payment</h2>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Method</dt>
                  <dd className="flex items-center gap-1.5 font-medium text-ink"><Wallet className="size-4 text-gold-600" aria-hidden="true" /> {PAYMENT_METHOD_LABEL[payment.method]}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Status</dt>
                  <dd className="text-right font-medium text-ink">{PAYMENT_STATUS_LABEL[payment.status]}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">{payment.status === "PAID" ? "Amount paid" : "Amount due at property"}</dt>
                  <dd className="font-semibold text-ink">{payment.status === "VOID" ? money(0) : money(payment.amountCents)}</dd>
                </div>
                {payment.paidAt && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Recorded</dt>
                    <dd className="text-right text-ink">
                      {formatDateTime(payment.paidAt)}
                      {payment.recordedBy && <span className="block text-xs text-muted">by {payment.recordedBy.name}</span>}
                    </dd>
                  </div>
                )}
              </dl>
              {payment.status === "UNPAID" && <p className="mt-4 text-xs leading-5 text-muted">No online payment has been taken. The host records the payment once it is collected at the property.</p>}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
