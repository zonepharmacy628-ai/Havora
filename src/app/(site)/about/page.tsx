import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Globe2, HeartHandshake, Wallet } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { ABOUT_IMAGE } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "About HAVORA", description: "HAVORA connects travellers with handpicked luxury villas, apartments and hotels around the world." };

const VALUES = [
  { icon: BadgeCheck, title: "Curated, not crowded", text: "Every listing is reviewed by our team before it is published, so browsing feels like a shortlist rather than a search." },
  { icon: Wallet, title: "Simple, honest pricing", text: "The price breakdown you see before reserving is the amount you pay at the property — itemised, with no surprises." },
  { icon: HeartHandshake, title: "Fair to hosts", text: "Owners set their own prices and rules, see their commission clearly and stay in control of their calendar." },
  { icon: Globe2, title: "Built for the world", text: "Stay dates follow each property's local time and prices are shown consistently in US dollars." },
];

export default async function AboutPage() {
  // Real figures only — these come straight from the database.
  const [properties, destinations, reviews] = await Promise.all([
    prisma.property.count({ where: { status: "PUBLISHED" } }),
    prisma.property.findMany({ where: { status: "PUBLISHED" }, distinct: ["city"], select: { city: true } }),
    prisma.review.count({ where: { status: "PUBLISHED" } }),
  ]);
  const stats = [
    { value: properties, label: `Published stay${properties === 1 ? "" : "s"}` },
    { value: destinations.length, label: `Destination${destinations.length === 1 ? "" : "s"}` },
    { value: reviews, label: `Guest review${reviews === 1 ? "" : "s"}` },
  ];

  return (
    <>
      <PageHero eyebrow="About us" title="Stays worth travelling for." subtitle="HAVORA is a marketplace for exceptional places to stay — private villas, design-led apartments, boutique hotels and quiet retreats, chosen with care." />

      <section className="container-page grid items-center gap-10 py-16 lg:grid-cols-2">
        <div>
          <h2 className="heading-serif text-3xl">Our story</h2>
          <div className="gold-rule my-5" />
          <div className="space-y-4 text-[15px] leading-7 text-muted">
            <p>
              We started HAVORA with a simple belief: finding a remarkable place to stay should feel as good as arriving there. That means fewer, better listings, clear information and a booking process you can trust.
            </p>
            <p>
              Guests reserve online in a few steps and pay the host directly at the property. Hosts get the tools they need — listings, calendars, reservations and earnings — in one calm dashboard.
            </p>
          </div>
          <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-cream-200 pt-6">
            {stats.map((stat) => (
              <div key={stat.label}>
                <dd className="font-serif text-4xl font-medium text-ink">{stat.value}</dd>
                <dt className="mt-1 text-xs text-muted">{stat.label}</dt>
              </div>
            ))}
          </dl>
        </div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-cream-200 shadow-lift">
          <Image src={ABOUT_IMAGE} alt="Resort pool surrounded by palm trees" fill sizes="(min-width: 1024px) 560px, 100vw" className="object-cover" />
        </div>
      </section>

      <section className="border-y border-cream-200 bg-white">
        <div className="container-page py-16">
          <h2 className="heading-serif mb-8 text-3xl">What we stand for</h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map(({ icon: Icon, title, text }) => (
              <div key={title}>
                <span className="mb-4 flex size-12 items-center justify-center rounded-xl bg-navy-800 text-gold-400">
                  <Icon className="size-6" aria-hidden="true" />
                </span>
                <h3 className="font-serif text-lg font-medium text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page py-16 text-center">
        <h2 className="heading-serif text-3xl">Ready when you are</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted">Explore our collection, or share your own property with travellers from around the world.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/properties" className="btn btn-gold btn-lg">
            Explore properties
          </Link>
          <Link href="/register?type=owner" className="btn btn-outline btn-lg">
            Become a host
          </Link>
        </div>
      </section>
    </>
  );
}
