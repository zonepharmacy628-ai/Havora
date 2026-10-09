import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { CANCELLATION_POLICIES } from "@/lib/constants";

export const metadata: Metadata = { title: "Cancellation Policy" };

export default function CancellationPolicyPage() {
  return (
    <>
      <PageHero eyebrow="Legal" title="Cancellation Policy" subtitle="Each property chooses one of three policies. Yours is shown on the property page, at checkout and on your booking." />
      <div className="container-page max-w-3xl py-14">
        <div className="grid gap-4 sm:grid-cols-3">
          {Object.entries(CANCELLATION_POLICIES).map(([key, policy]) => (
            <div key={key} className="card card-pad">
              <p className="eyebrow mb-2">{policy.label}</p>
              <p className="font-serif text-3xl font-medium text-ink">
                {policy.freeDays} day{policy.freeDays === 1 ? "" : "s"}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted">{policy.summary}</p>
            </div>
          ))}
        </div>

        <article className="prose-legal">
          <h2>How cancelling works</h2>
          <ul>
            <li>
              <strong>Inside the free cancellation window</strong> — you can cancel instantly from <Link href="/account/bookings">My Bookings</Link>. The booking is cancelled and nothing is owed.
            </li>
            <li>
              <strong>After the window closes</strong> — you can send a cancellation request. The host reviews it and either approves the cancellation or keeps the booking in place.
            </li>
            <li>
              <strong>Requests not yet confirmed</strong> — a booking request the host has not accepted can be withdrawn at any time.
            </li>
            <li>
              <strong>Once your stay has started</strong> — bookings can no longer be cancelled online; please speak to your host.
            </li>
          </ul>

          <h2>Dates and time zones</h2>
          <p>
            Cancellation deadlines are calculated in the property&apos;s local time. “5 days before check-in” means you can cancel up to and including the calendar date five days before your check-in date.
          </p>

          <h2>Payments</h2>
          <p>
            HAVORA bookings are currently Pay at Property, so no money is taken online and there is nothing to refund through HAVORA when a booking is cancelled. If a host cancels a confirmed booking, you will see it as cancelled in your account with the host&apos;s note.
          </p>

          <h2>No-shows</h2>
          <p>If you do not arrive and have not cancelled, the host may record the booking as a no-show.</p>

          <h2>Need help?</h2>
          <p>
            If something has gone wrong with a booking, <Link href="/contact">contact our team</Link> with your booking reference.
          </p>
        </article>
      </div>
    </>
  );
}
