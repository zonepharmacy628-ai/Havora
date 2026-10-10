import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Globe2, Quote, ShieldCheck, Wallet, Zap } from "lucide-react";
import { PropertyCard } from "@/components/property-card";
import { SearchBar } from "@/components/search-bar";
import { SectionHeading, Stars } from "@/components/ui";
import { getPublicCategories, withFallbackImages } from "@/lib/categories";
import { HERO_IMAGE, HOST_IMAGE } from "@/lib/constants";
import { toIso } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { getFeaturedProperties, getPopularDestinations, getRecommendedProperties } from "@/lib/properties";

export const dynamic = "force-dynamic";

const TRUST = [
  { icon: BadgeCheck, title: "Reviewed Listings", text: "Every home is checked before it goes live" },
  { icon: Zap, title: "No Account Needed", text: "Book as a guest in minutes" },
  { icon: Wallet, title: "Pay at Property", text: "Reserve now, no online charge" },
  { icon: Globe2, title: "Global Destinations", text: "Luxury stays worldwide" },
];

export default async function HomePage() {
  const [featured, destinations, allCategories, testimonials] = await Promise.all([
    getFeaturedProperties(4),
    getPopularDestinations(5),
    getPublicCategories(),
    // Testimonials are genuine published guest reviews from the database — never invented copy.
    prisma.review.findMany({
      where: { status: "PUBLISHED", rating: 5, property: { status: "PUBLISHED" } },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, comment: true, rating: true, authorName: true, author: { select: { name: true, country: true } }, property: { select: { title: true, slug: true } } },
    }),
  ]);
  const recommended = await getRecommendedProperties(featured.map((p) => p.id), 4);
  // Categories come from the database; only those with published listings are shown.
  const categories = await withFallbackImages(allCategories.filter((category) => category.count > 0));

  return (
    <>
      {/* ───────── Hero ───────── */}
      <section className="relative isolate overflow-hidden bg-navy-950">
        <Image src={HERO_IMAGE} alt="Luxury villa with an infinity pool at sunset" fill priority sizes="100vw" className="-z-20 object-cover" />
        <div className="hero-overlay absolute inset-0 -z-10" />
        <div className="container-page pt-16 pb-10 sm:pt-24 lg:pt-28">
          <div className="animate-fade-up max-w-2xl">
            <p className="eyebrow mb-5 text-gold-400">Luxury stays await</p>
            <h1 className="font-serif text-[42px] leading-[1.08] font-medium tracking-tight text-white sm:text-6xl">
              Find a place you&apos;ll
              <br />
              love to <em className="text-gold-400">stay.</em>
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-7 text-navy-200">
              Discover extraordinary villas, apartments and hotels in the world&apos;s most beautiful destinations.
            </p>
          </div>
          <div className="animate-fade-up mt-9 max-w-5xl" style={{ animationDelay: "120ms" }}>
            <SearchBar today={toIso(new Date())} />
          </div>
          <ul className="mt-12 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-white/10 pt-8 lg:grid-cols-4">
            {TRUST.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-gold-500/40 text-gold-400">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-[13px] font-semibold text-white">{title}</span>
                  <span className="block text-xs text-navy-200">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ───────── Popular destinations ───────── */}
      {destinations.length > 0 && (
        <section className="container-page pt-16">
          <SectionHeading title="Popular Destinations" subtitle="Explore handpicked destinations for your next getaway." href="/properties" linkLabel="View all destinations" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {destinations.map((destination, index) => (
              <Link
                key={`${destination.city}-${destination.country}`}
                href={`/properties?q=${encodeURIComponent(destination.city)}`}
                className={`group relative isolate aspect-[4/5] items-end overflow-hidden rounded-2xl bg-navy-800 shadow-card ${index === 4 ? "hidden sm:flex" : "flex"}`}
              >
                {destination.image && (
                  <Image src={destination.image} alt={destination.city} fill sizes="(min-width: 1024px) 240px, 45vw" className="-z-10 object-cover transition duration-700 group-hover:scale-105" />
                )}
                <div className="absolute inset-0 -z-10 bg-gradient-to-t from-navy-950/90 via-navy-950/15 to-transparent" />
                <div className="p-4">
                  <h3 className="font-serif text-xl font-medium text-white">{destination.city}</h3>
                  <p className="text-xs text-navy-200">{destination.country}</p>
                  <p className="mt-1 text-[11px] font-semibold tracking-wide text-gold-400 uppercase">
                    {destination.count} stay{destination.count === 1 ? "" : "s"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ───────── Featured properties ───────── */}
      <section className="container-page pt-16">
        <SectionHeading title="Featured Properties" subtitle="Luxury stays, handpicked for you." href="/properties" linkLabel="View all properties" />
        {featured.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((property, index) => (
              <PropertyCard key={property.id} property={property} priority={index < 2} />
            ))}
          </div>
        ) : (
          <p className="card card-pad text-sm text-muted">New stays are being prepared. Please check back soon.</p>
        )}
      </section>

      {/* ───────── Categories ───────── */}
      {categories.length > 0 && (
        <section className="container-page pt-16">
          <SectionHeading title="Browse by Category" subtitle="From private villas to city apartments." />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {categories.map((category) => (
              <Link key={category.id} href={`/properties?category=${category.slug}`} className="group card overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lift">
                <div className="relative aspect-[5/4] overflow-hidden bg-cream-200">
                  {category.imageUrl && <Image src={category.imageUrl} alt="" fill sizes="(min-width: 1024px) 200px, 45vw" className="object-cover transition duration-700 group-hover:scale-105" />}
                </div>
                <div className="px-3.5 py-3">
                  <h3 className="text-sm font-semibold text-ink">{category.name}</h3>
                  <p className="text-xs text-muted">
                    {category.count} listing{category.count === 1 ? "" : "s"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ───────── Recommended ───────── */}
      {recommended.length > 0 && (
        <section className="container-page pt-16">
          <SectionHeading title="Recommended Stays" subtitle="Loved by guests for comfort, location and service." href="/properties?sort=rating" linkLabel="See top rated" />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {recommended.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        </section>
      )}

      {/* ───────── Trust & safety ───────── */}
      <section className="container-page pt-16">
        <div className="card grid gap-8 p-7 sm:p-10 lg:grid-cols-3">
          {[
            { icon: ShieldCheck, title: "Book with confidence", text: "Listings are reviewed by our team before publication, and every review comes from a guest who completed a stay." },
            { icon: Wallet, title: "No online charge", text: "Reserve your dates today and pay the host directly at the property. Your booking shows the exact amount due." },
            { icon: BadgeCheck, title: "Clear cancellation terms", text: "Each stay shows its cancellation policy up front, so you always know your options before you reserve." },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title}>
              <span className="mb-4 flex size-12 items-center justify-center rounded-xl bg-navy-800 text-gold-400">
                <Icon className="size-6" aria-hidden="true" />
              </span>
              <h3 className="heading-serif text-xl">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── Testimonials (real reviews only) ───────── */}
      {testimonials.length > 0 && (
        <section className="container-page pt-16">
          <SectionHeading title="What Guests Say" subtitle="Recent five-star reviews from completed stays." />
          <div className="grid gap-5 lg:grid-cols-3">
            {testimonials.map((review) => (
              <figure key={review.id} className="card card-pad flex flex-col">
                <Quote className="mb-3 size-7 text-gold-400" aria-hidden="true" />
                <blockquote className="flex-1 text-[15px] leading-7 text-ink">{review.comment}</blockquote>
                <figcaption className="mt-5 border-t border-cream-200 pt-4">
                  <Stars rating={review.rating} className="size-3.5" />
                  <p className="mt-1.5 text-sm font-semibold text-ink">
                    {review.author?.name ?? review.authorName ?? "Guest"}
                    {review.author?.country && <span className="font-normal text-muted"> · {review.author.country}</span>}
                  </p>
                  <Link href={`/properties/${review.property.slug}`} className="text-xs text-gold-700 hover:underline">
                    Stayed at {review.property.title}
                  </Link>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* ───────── Become a host ───────── */}
      <section className="container-page py-16">
        <div className="relative isolate overflow-hidden rounded-3xl bg-navy-900">
          <Image src={HOST_IMAGE} alt="" fill sizes="(min-width: 1280px) 1216px, 100vw" className="-z-20 object-cover" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-navy-950 via-navy-950/85 to-navy-950/30" />
          <div className="flex flex-col items-start gap-6 p-8 sm:p-12 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <p className="eyebrow mb-3 text-gold-400">Become a host</p>
              <h2 className="font-serif text-3xl leading-tight font-medium text-white sm:text-4xl">List your property on HAVORA</h2>
              <p className="mt-3 text-[15px] leading-7 text-navy-200">
                Reach travellers from around the world, manage your calendar and reservations in one place, and keep full control of your pricing.
              </p>
            </div>
            <Link href="/host" className="btn btn-gold btn-lg">
              List Your Property <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
