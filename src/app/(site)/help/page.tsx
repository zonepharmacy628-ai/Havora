import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { PageHero } from "@/components/page-hero";

export const metadata: Metadata = { title: "Help Center & FAQ", description: "Answers to common questions about booking, payment, cancellations and hosting on HAVORA." };

const FAQ: { group: string; items: { q: string; a: string }[] }[] = [
  {
    group: "Booking",
    items: [
      { q: "How do I book a stay?", a: "Search for a destination, open a property, choose your dates on the availability calendar and select your guests. Review the price breakdown, add your details at checkout and confirm. You need a free HAVORA account to reserve." },
      { q: "Is my booking confirmed immediately?", a: "Properties marked “Instant confirmation” are confirmed as soon as you reserve. For other properties your request is sent to the host, who confirms or declines it. You can follow the status in My Bookings." },
      { q: "Where can I find my booking reference?", a: "Every booking has a unique reference such as HV-AB12CD34. It is shown on the confirmation page and in My Bookings." },
      { q: "Why are some dates unavailable?", a: "Dates are unavailable when another guest has already reserved them or the host has blocked them. Availability is checked again on our server at the moment you confirm, so two guests can never book the same nights." },
    ],
  },
  {
    group: "Payment",
    items: [
      { q: "How do I pay?", a: "HAVORA currently offers Pay at Property. Nothing is charged online when you reserve — you pay the full booking total directly to the host when you arrive. Your booking page shows the exact amount due." },
      { q: "Can I pay online by card?", a: "Not yet. Online payment is planned for a future release and is clearly marked as “Coming soon” at checkout. We never ask for card details on this site today." },
      { q: "What is included in the total?", a: "The total is the nightly price multiplied by the number of nights, plus the property's cleaning fee (if any) and the HAVORA service fee. All amounts are shown in US dollars." },
      { q: "Why does my booking show “Unpaid”?", a: "With Pay at Property the payment stays “Unpaid — due at property” until you pay the host on arrival. The host then records the payment and your booking shows as “Paid”." },
    ],
  },
  {
    group: "Changes & cancellations",
    items: [
      { q: "How do I cancel a booking?", a: "Open the booking from My Bookings and use the Cancellation section. Inside the free cancellation window your booking is cancelled immediately. After that you can send a cancellation request, which the host approves or declines." },
      { q: "What are the cancellation policies?", a: "Each property uses one of three policies — Flexible (free cancellation until 1 day before check-in), Moderate (5 days) or Strict (14 days). The policy is shown on the property page and at checkout." },
      { q: "Can I change my dates?", a: "To change dates, cancel within the free window and make a new booking, or contact your host using the details on your confirmed booking." },
    ],
  },
  {
    group: "Hosting",
    items: [
      { q: "How do I list my property?", a: "Create an account as a host, add your property details and at least three photos, then submit the listing. Our team reviews new listings before they are published." },
      { q: "What does HAVORA charge hosts?", a: "HAVORA charges a commission on the accommodation subtotal of each booking. The current rate and your estimated earnings are always visible in your host dashboard." },
      { q: "How do I manage availability?", a: "Bookings block your calendar automatically. You can also block dates yourself from the listing's Availability section, for example for maintenance or personal use." },
    ],
  },
];

export default function HelpPage() {
  return (
    <>
      <PageHero eyebrow="Help Center" title="Frequently asked questions" subtitle="Everything you need to know about booking, paying and hosting with HAVORA." />
      <div className="container-page max-w-4xl py-14">
        {FAQ.map((section) => (
          <section key={section.group} className="mb-10">
            <h2 className="heading-serif mb-4 text-2xl">{section.group}</h2>
            <div className="card divide-y divide-cream-200">
              {section.items.map((item) => (
                <details key={item.q} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[15px] font-medium text-ink transition hover:text-gold-700 [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <ChevronDown className="size-4 shrink-0 text-gold-600 transition group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <p className="px-5 pb-5 text-sm leading-7 text-muted">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
        <div className="card card-pad flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-serif text-lg font-medium text-ink">Still need help?</h2>
            <p className="text-sm text-muted">Our team replies to every message by email.</p>
          </div>
          <Link href="/contact" className="btn btn-gold">
            Contact us
          </Link>
        </div>
      </div>
    </>
  );
}
