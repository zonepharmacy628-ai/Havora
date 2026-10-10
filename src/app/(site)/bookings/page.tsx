import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, Search, ShieldCheck } from "lucide-react";
import { requestBookingLinkAction } from "@/actions/booking";
import { bookingListInclude, TripList } from "@/components/booking-list";
import { ActionForm, SubmitButton, TextField } from "@/components/forms";
import { PageHero } from "@/components/page-hero";
import { Notice } from "@/components/ui";
import { completeFinishedStays } from "@/lib/bookings";
import { emailConfigured } from "@/lib/email";
import { isValidAccessKey, readDeviceBookings } from "@/lib/guest-access";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "My bookings",
  description: "Find and manage your HAVORA booking.",
  robots: { index: false, follow: false },
};

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ need?: string }>;
}) {
  const [{ need }, user, device] = await Promise.all([
    searchParams,
    getCurrentUser(),
    readDeviceBookings(),
  ]);

  // Bookings this browser holds a valid private key for.
  const candidates = device.length
    ? await prisma.booking.findMany({
        where: { reference: { in: device.map((entry) => entry.reference) } },
        include: bookingListInclude,
      })
    : [];
  const deviceBookings = candidates.filter((booking) => {
    const entry = device.find((item) => item.reference === booking.reference);
    return entry ? isValidAccessKey(booking, entry.key) : false;
  });

  // Bookings linked to a legacy customer account (or made by a host/admin while signed in).
  if (user) await completeFinishedStays(prisma, { customerId: user.id });
  const accountBookings = user
    ? await prisma.booking.findMany({
        where: {
          customerId: user.id,
          id: { notIn: deviceBookings.map((booking) => booking.id) },
        },
        orderBy: { checkIn: "desc" },
        take: 100,
        include: bookingListInclude,
      })
    : [];

  const bookings = [...deviceBookings, ...accountBookings].sort(
    (a, b) => b.checkIn.getTime() - a.checkIn.getTime(),
  );

  // Booking links can be emailed when a mail provider is configured. Outside
  // production the link is printed in the server log, so the form stays usable.
  const emailOn = emailConfigured();
  const canRequestLink = emailOn || process.env.NODE_ENV !== "production";

  return (
    <>
      <PageHero
        eyebrow="My bookings"
        title="Find and manage your booking"
        subtitle={
          emailOn
            ? "No account needed. Open your booking with the private link we sent you, or request a new one below."
            : "No account needed. Open your booking with the private link you saved when you booked."
        }
      />
      <div className="container-page grid gap-8 py-12 lg:grid-cols-[1fr_400px]">
        <section aria-labelledby="your-bookings">
          {need === "1" && (
            <div className="mb-5">
              <Notice tone="warning">
                {emailOn
                  ? "To open a booking, use the private link from your confirmation email, or request a new link with your booking reference and email address."
                  : "To open a booking, use the private link shown on your confirmation page. A booking reference on its own does not open a booking."}
              </Notice>
            </div>
          )}
          <h2 id="your-bookings" className="heading-serif mb-4 text-2xl">
            {user ? "Your bookings" : "Bookings on this device"}
          </h2>
          {bookings.length > 0 ? (
            <TripList bookings={bookings} />
          ) : (
            <div className="card card-pad text-sm text-muted">
              <p>No bookings are available on this device yet.</p>
              <p className="mt-2">
                {emailOn
                  ? "Bookings you make here appear automatically. If you booked on another device, open the private link from your confirmation email or request a new one."
                  : "Bookings you make here appear automatically. If you booked on another device, open the private link you saved when you booked."}
              </p>
              <Link href="/properties" className="btn btn-gold mt-5">
                Browse properties
              </Link>
            </div>
          )}
          {!user && (
            <p className="mt-5 text-xs text-muted">
              Have an older HAVORA account?{" "}
              <Link
                href="/login?next=/bookings"
                className="font-semibold text-gold-700 hover:underline"
              >
                Sign in
              </Link>{" "}
              to see bookings linked to it.
            </p>
          )}
        </section>

        <aside className="space-y-5 lg:self-start">
          <section className="card card-pad" aria-labelledby="find-booking">
            <h2
              id="find-booking"
              className="mb-1 flex items-center gap-2 font-serif text-xl font-medium text-ink"
            >
              <Search className="size-5 text-gold-600" aria-hidden="true" />{" "}
              Find my booking
            </h2>
            {canRequestLink && (
              <p className="mb-5 text-sm text-muted">
                Enter the reference and the email address used when booking.
                We&apos;ll email a private link to that address.
              </p>
            )}
            {!emailOn && canRequestLink && (
              <div className="mb-4">
                <Notice tone="warning">
                  Development mode: email is not configured, so the link is
                  printed in the server log instead of being sent.
                </Notice>
              </div>
            )}
            {!canRequestLink && (
              <div className="mt-4">
                <Notice tone="warning">
                  We can&apos;t email booking links at the moment. If you have
                  lost your private link, please{" "}
                  <Link
                    href="/contact"
                    className="font-semibold underline underline-offset-2"
                  >
                    contact our support team
                  </Link>{" "}
                  with your booking reference.
                </Notice>
              </div>
            )}
            {canRequestLink && (
              <ActionForm
                action={requestBookingLinkAction}
                className="space-y-4"
                resetOnSuccess
              >
                <TextField
                  name="reference"
                  label="Booking reference"
                  placeholder="HV-AB23CD45"
                  autoComplete="off"
                  autoCapitalize="characters"
                  maxLength={20}
                  required
                />
                <TextField
                  name="email"
                  label="Email address"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                />
                <SubmitButton
                  className="btn btn-gold w-full"
                  pendingText="Sending…"
                >
                  Email me my booking link
                </SubmitButton>
              </ActionForm>
            )}
          </section>

          <div className="card card-pad space-y-4 text-sm text-muted">
            <p className="flex items-start gap-3">
              <KeyRound
                className="mt-0.5 size-5 shrink-0 text-gold-600"
                aria-hidden="true"
              />
              <span>
                Your private link is the key to your booking. A booking
                reference on its own never opens booking details.
              </span>
            </p>
            <p className="flex items-start gap-3">
              <ShieldCheck
                className="mt-0.5 size-5 shrink-0 text-gold-600"
                aria-hidden="true"
              />
              <span>
                Keep the link to yourself. Anyone who has it can view and cancel
                the booking.
              </span>
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
