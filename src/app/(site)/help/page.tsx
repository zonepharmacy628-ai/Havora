import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { PageHero } from "@/components/page-hero";

export const metadata: Metadata = { title: "Help Center & FAQ", description: "Answers to common questions about booking, payment, cancellations and hosting on HAVORA." };

const FAQ: { group: string; items: { q: string; a: string }[] }[] = [
  {
    group: "Booking",
    items: [
      { q: "How do I book a stay?", a: "Search for a destination, open a property, choose your dates on the availability calendar and select your guests. Review the price breakdown, enter your name, email and phone at checkout and confirm. You do not need to create an account." },
      { q: "Is my booking confirmed immediately?", a: "Properties marked “Instant confirmation” are confirmed as soon as you reserve. For other properties your request is sent to the host, who confirms or declines it. You can follow the status on your booking page." },
      { q: "Where can I find my booking reference?", a: "Every booking has a unique reference such as HV-AB23CD45. It is shown on the confirmation page and in your confirmation email." },
      { q: "How do I get back to my booking?", a: "Use the private link shown on your confirmation page and sent to your email — it opens your booking on any device without a password. On the device you booked with, My Bookings also lists it. If you have lost the link, go to My Bookings, enter your booking reference and email address, and we will email you a new private link." },
      { q: "Why isn't my booking reference enough to open my booking?", a: "To protect your personal details, a reference number on its own never shows booking information. Only your private link (or the host and HAVORA staff) can open a booking. Keep your link to yourself: anyone who has it can view and cancel the booking." },
      { q: "Why are some dates unavailable?", a: "Dates are unavailable when another guest has already reserved them or the host has blocked them. Availability is checked again on our server at the moment you confirm, so two guests can never book the same nights." },
    ],
  },
  {
    group: "Wishlist",
    items: [
      { q: "How does the wishlist work?", a: "Tap the heart on any property to save it. Your wishlist is stored in your browser on the device you are using, so no account is needed." },
      { q: "Why is my wishlist empty on another device?", a: "Because it is stored in your browser, it does not sync between devices or browsers, and it is cleared if you delete your browsing data or use private browsing." },
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
      { q: "How do I cancel a booking?", a: "Open your booking with your private link and use the Cancellation section. Inside the free cancellation window your booking is cancelled immediately. After that you can send a cancellation request, which the host approves or declines." },
      { q: "What are the cancellation policies?", a: "Each property uses one of three policies — Flexible (free cancellation until 1 day before check-in), Moderate (5 days) or Strict (14 days). The policy is shown on the property page and at checkout." },
      { q: "Can I change my dates?", a: "To change dates, cancel within the free window and make a new booking, or contact your host using the details on your confirmed booking." },
    ],
  },
  {
    group: "Hosting",
    items: [
      { q: "How do I list my property?", a: "Choose “List Your Property”, create a host account, add your property details and at least three photos, set your availability, then submit the listing. Our team reviews new listings before they are published." },
      { q: "Do I need an account to host?", a: "Yes. Guests book without an account, but hosts sign in to a secure Owner Dashboard to manage listings, calendars and reservations. Host accounts are created separately on the host registration page." },
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
