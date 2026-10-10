import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarX, CreditCard, Lock, MapPin, Wallet } from "lucide-react";
import { createBookingAction } from "@/actions/booking";
import { ActionForm, SubmitButton, TextAreaField, TextField } from "@/components/forms";
import { EmptyState, Rating } from "@/components/ui";
import { freeCancellationDeadline, validateStay } from "@/lib/booking-rules";
import { findConflict, newIdempotencyKey } from "@/lib/bookings";
import { CANCELLATION_POLICIES, HERO_IMAGE } from "@/lib/constants";
import { formatDate, nightsBetween, todayIn } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { calculateQuote } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { staySchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Booking Checkout", robots: { index: false } };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const str = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

function Unavailable({ title, text, href }: { title: string; text: string; href: string }) {
  return (
    <div className="container-page max-w-2xl py-16">
      <EmptyState
        icon={CalendarX}
        title={title}
        text={text}
        action={
          <Link href={href} className="btn btn-gold">
            Choose different dates
          </Link>
        }
      />
    </div>
  );
}

export default async function CheckoutPage({ searchParams }: Props) {
  const query = await searchParams;
  const slug = str(query.property);
  // Guests check out without an account. A signed-in host/admin/legacy customer is only used to pre-fill the form.
  const user = await getCurrentUser();

  const property = slug
    ? await prisma.property.findUnique({
        where: { slug },
        include: { images: { orderBy: { position: "asc" }, take: 1 }, owner: { select: { status: true } } },
      })
    : null;
  if (!property || property.status !== "PUBLISHED" || property.owner.status !== "ACTIVE") redirect("/properties");

  const backHref = `/properties/${property.slug}`;
  const parsed = staySchema.safeParse({ checkIn: str(query.checkIn), checkOut: str(query.checkOut), adults: str(query.adults) || "1", children: str(query.children) || "0" });
  if (!parsed.success) redirect(backHref);
  const stay = parsed.data;

  // Everything below is validated and priced on the server from database values.
  const today = todayIn(property.timezone);
  const problem =
    user && property.ownerId === user.id
      ? "You cannot book your own property."
      : validateStay({ ...stay, today, property });
  if (problem) return <Unavailable title="This stay can't be booked" text={problem} href={backHref} />;
  if (await findConflict(prisma, property.id, stay.checkIn, stay.checkOut)) {
    return <Unavailable title="Those dates were just taken" text="Another guest has reserved some of these nights. Please pick different dates." href={`${backHref}#availability`} />;
  }

  const settings = await getSettings();
  const nights = nightsBetween(stay.checkIn, stay.checkOut);
  const quote = calculateQuote({
    nightlyPriceCents: property.nightlyPriceCents,
    cleaningFeeCents: property.cleaningFeeCents,
    nights,
    serviceFeeBps: settings.serviceFeeRateBps,
    commissionBps: settings.commissionRateBps,
  });
  const money = (cents: number) => formatMoney(cents, property.currency);
  const policy = CANCELLATION_POLICIES[property.cancellationPolicy];
  const deadline = freeCancellationDeadline(stay.checkIn, property.cancellationPolicy);
  const guests = stay.adults + stay.children;
  const cover = property.images[0];

  return (
    <>
      <section className="relative isolate bg-navy-950">
        <Image src={HERO_IMAGE} alt="" fill sizes="100vw" className="-z-20 object-cover object-[center_70%]" />
        <div className="hero-overlay absolute inset-0 -z-10" />
        <div className="container-page py-10">
          <h1 className="font-serif text-4xl font-medium tracking-tight text-white">Booking Checkout</h1>
          <p className="mt-2 text-[15px] text-navy-200">Complete your reservation — no account needed.</p>
        </div>
      </section>

      <div className="container-page py-10">
        <ActionForm action={createBookingAction}>
          <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          {/* Only identifiers and the guest's own details are submitted — never prices. */}
          <input type="hidden" name="propertyId" value={property.id} />
          <input type="hidden" name="checkIn" value={stay.checkIn} />
          <input type="hidden" name="checkOut" value={stay.checkOut} />
          <input type="hidden" name="adults" value={stay.adults} />
          <input type="hidden" name="children" value={stay.children} />
          {/* Makes a double-click or retry return the same booking instead of creating a second one. */}
          <input type="hidden" name="idempotencyKey" value={newIdempotencyKey()} />
          {/* Honeypot for automated submissions — hidden from people and assistive technology. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>
              Company
              <input type="text" name="company" tabIndex={-1} autoComplete="off" />
            </label>
          </div>

          <div className="space-y-6">
            <section className="card card-pad" aria-labelledby="property-details">
              <h2 id="property-details" className="mb-4 font-serif text-xl font-medium text-ink">Property Details</h2>
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-xl bg-cream-200 sm:w-44">
                  {cover && <Image src={cover.url} alt={cover.alt || property.title} fill sizes="176px" className="object-cover" />}
                </div>
                <div className="min-w-0">
                  <h3 className="font-serif text-lg font-medium text-ink">{property.title}</h3>
                  <p className="mt-1 flex items-center gap-1 text-[13px] text-muted">
                    <MapPin className="size-3.5" aria-hidden="true" /> {property.city}, {property.country}
                  </p>
                  <Rating value={property.ratingAvg} count={property.ratingCount} className="mt-1.5" />
                  <dl className="mt-4 grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <dt className="text-xs text-muted">Check-in</dt>
                      <dd className="font-semibold text-ink">{formatDate(stay.checkIn)}</dd>
                      <dd className="text-xs text-muted">from {property.checkInFrom}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Check-out</dt>
                      <dd className="font-semibold text-ink">{formatDate(stay.checkOut)}</dd>
                      <dd className="text-xs text-muted">by {property.checkOutBy}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Guests</dt>
                      <dd className="font-semibold text-ink">{guests}</dd>
                      <dd className="text-xs text-muted">
                        {nights} night{nights === 1 ? "" : "s"}
                      </dd>
                    </div>
                  </dl>
                  <Link href={`${backHref}?checkIn=${stay.checkIn}&checkOut=${stay.checkOut}&guests=${guests}#availability`} className="mt-3 inline-block text-xs font-semibold text-gold-700 hover:underline">
                    Change dates or guests
                  </Link>
                </div>
              </div>
            </section>

            <section className="card card-pad" aria-labelledby="guest-info">
              <h2 id="guest-info" className="mb-4 font-serif text-xl font-medium text-ink">Guest Information</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField name="contactName" label="Full name" defaultValue={user?.name} autoComplete="name" required className="sm:col-span-2" />
                <TextField name="contactEmail" label="Email address" type="email" defaultValue={user?.email} autoComplete="email" required hint="Your confirmation and private booking link are sent here." />
                <TextField name="contactPhone" label="Phone number" type="tel" defaultValue={user?.phone ?? ""} placeholder="+1 234 567 8900" autoComplete="tel" required hint="Include your country code so the host can reach you." />
                {guests > 1 && (
                  <TextAreaField name="additionalGuests" label="Other guests (optional)" rows={2} placeholder="One name per line" className="sm:col-span-2" />
                )}
                <TextAreaField name="specialRequests" label="Special requests (optional)" rows={3} placeholder="Arrival time, dietary needs, celebrations…" hint="Requests are passed to the host and are subject to availability." className="sm:col-span-2" />
              </div>
            </section>

            <section className="card card-pad" aria-labelledby="booking-method">
              <h2 id="booking-method" className="mb-4 font-serif text-xl font-medium text-ink">Booking Method</h2>
              <div className="space-y-3">
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-gold-500 bg-gold-50 p-4">
                  <input type="radio" name="paymentMethod" value="PAY_AT_PROPERTY" defaultChecked className="mt-1 size-4 accent-gold-600" />
                  <span>
                    <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <Wallet className="size-4 text-gold-600" aria-hidden="true" /> Pay at property
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-muted">
                      Nothing is charged today. Pay {money(quote.totalCents)} directly to the host on arrival (cash or card, as accepted by the property).
                    </span>
                  </span>
                </label>
                <label className="flex cursor-not-allowed items-start gap-3 rounded-xl border border-cream-300 bg-cream-50 p-4 opacity-70">
                  <input type="radio" name="paymentMethod" value="ONLINE" disabled className="mt-1 size-4" />
                  <span>
                    <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <CreditCard className="size-4 text-muted" aria-hidden="true" /> Online payment
                      <span className="badge bg-cream-200 text-muted">Coming soon</span>
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-muted">Secure online card payment is not available yet.</span>
                  </span>
                </label>
              </div>
            </section>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="card card-pad">
              <h2 className="mb-4 font-serif text-xl font-medium text-ink">Price Breakdown</h2>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">
                    {money(quote.nightlyPriceCents)} × {nights} night{nights === 1 ? "" : "s"}
                  </dt>
                  <dd className="font-medium text-ink">{money(quote.subtotalCents)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Cleaning fee</dt>
                  <dd className="font-medium text-ink">{money(quote.cleaningFeeCents)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Service fee</dt>
                  <dd className="font-medium text-ink">{money(quote.serviceFeeCents)}</dd>
                </div>
                <div className="flex justify-between border-t border-cream-200 pt-3 text-base">
                  <dt className="font-semibold text-ink">Total ({property.currency})</dt>
                  <dd className="font-serif text-xl font-semibold text-ink">{money(quote.totalCents)}</dd>
                </div>
              </dl>

              <div className="mt-5 flex items-start gap-3 rounded-xl bg-gold-50 p-4 ring-1 ring-gold-100">
                <Wallet className="mt-0.5 size-5 shrink-0 text-gold-600" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-ink">Pay at property</p>
                  <p className="text-xs leading-5 text-muted">Due on arrival: {money(quote.totalCents)}. Due now: {money(0)}.</p>
                </div>
              </div>

              <SubmitButton className="btn btn-gold btn-lg mt-5 w-full" pendingText="Reserving…">
                {property.instantBook ? "Confirm Booking" : "Request Booking"}
              </SubmitButton>
              {!property.instantBook && <p className="mt-2 text-center text-xs text-muted">The host reviews requests before confirming.</p>}

              <p className="mt-4 text-xs leading-5 text-muted">
                <strong className="text-ink">{policy.label} cancellation.</strong>{" "}
                {deadline >= today ? `Cancel free of charge until ${formatDate(deadline)}.` : "The free cancellation window for these dates has passed; cancellations need the host's approval."}
              </p>
              <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-muted">
                <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <span>
                  By reserving you agree to the{" "}
                  <Link href="/terms" className="font-medium text-gold-700 hover:underline">Terms</Link> and{" "}
                  <Link href="/cancellation-policy" className="font-medium text-gold-700 hover:underline">Cancellation Policy</Link>.
                </span>
              </p>
            </div>
          </aside>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
