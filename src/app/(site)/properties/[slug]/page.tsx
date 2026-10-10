import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Bath, BedDouble, CalendarCheck, ChevronRight, Clock, DoorOpen, MapPin, ScrollText, Users, Zap } from "lucide-react";
import { AvailabilityCalendar, BookingPanel, BookingProvider } from "@/components/booking-widget";
import { Gallery } from "@/components/gallery";
import { PropertyCard } from "@/components/property-card";
import { AmenityIcon, Avatar, Notice, Rating, SectionHeading, Stars } from "@/components/ui";
import { WishlistButton } from "@/components/wishlist-button";
import { canManageProperty } from "@/lib/booking-rules";
import { getUnavailableRanges } from "@/lib/bookings";
import { CANCELLATION_POLICIES, LISTING_STATUS_LABEL } from "@/lib/constants";
import { formatDate, isIsoDate, todayIn } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { cardSelect } from "@/lib/properties";
import { getCurrentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const getProperty = cache((slug: string) =>
  prisma.property.findUnique({
    where: { slug },
    include: {
      images: { orderBy: { position: "asc" } },
      category: { select: { name: true } },
      amenities: { include: { amenity: true }, orderBy: { amenity: { label: "asc" } } },
      owner: { select: { id: true, name: true, bio: true, country: true, createdAt: true, status: true, _count: { select: { properties: { where: { status: "PUBLISHED" } } } } } },
    },
  }),
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const property = await getProperty(slug);
  if (!property || property.status !== "PUBLISHED") return { title: "Property" };
  return {
    title: `${property.title} — ${property.city}, ${property.country}`,
    description: property.summary,
    openGraph: { images: property.images[0] ? [property.images[0].url] : [] },
  };
}

const str = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export default async function PropertyPage({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const [property, user] = await Promise.all([getProperty(slug), getCurrentUser()]);
  if (!property) notFound();

  // Unpublished listings are only visible to their owner and to administrators (as a preview).
  const isLive = property.status === "PUBLISHED" && property.owner.status === "ACTIVE";
  const isManager = user ? canManageProperty(user, property) : false;
  if (!isLive && !isManager) notFound();

  const today = todayIn(property.timezone);
  const [settings, unavailable, reviews, similar] = await Promise.all([
    getSettings(),
    getUnavailableRanges(prisma, property.id, today),
    prisma.review.findMany({
      where: { propertyId: property.id, status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, rating: true, comment: true, createdAt: true, authorName: true, author: { select: { name: true, country: true } } },
    }),
    prisma.property.findMany({
      where: { status: "PUBLISHED", owner: { status: "ACTIVE" }, id: { not: property.id }, OR: [{ city: property.city }, ...(property.categoryId ? [{ categoryId: property.categoryId }] : [])] },
      orderBy: [{ ratingAvg: "desc" }, { ratingCount: "desc" }],
      take: 4,
      select: cardSelect,
    }),
  ]);

  const checkIn = str(query.checkIn);
  const checkOut = str(query.checkOut);
  const datesValid = isIsoDate(checkIn) && isIsoDate(checkOut) && checkOut > checkIn && checkIn >= today;
  const guests = Math.min(Math.max(Number.parseInt(str(query.guests), 10) || 2, 1), property.maxGuests);
  const policy = CANCELLATION_POLICIES[property.cancellationPolicy];
  const sleeping = Array.isArray(property.sleepingArrangements) ? (property.sleepingArrangements as { room: string; beds: string }[]) : [];
  const isOwnListing = user?.id === property.ownerId;

  const facts = [
    { icon: Users, label: `${property.maxGuests} guest${property.maxGuests === 1 ? "" : "s"}` },
    { icon: DoorOpen, label: `${property.bedrooms} bedroom${property.bedrooms === 1 ? "" : "s"}` },
    { icon: BedDouble, label: `${property.beds} bed${property.beds === 1 ? "" : "s"}` },
    { icon: Bath, label: `${property.bathrooms} bathroom${property.bathrooms === 1 ? "" : "s"}` },
  ];

  return (
    <div className="container-page py-6 sm:py-8">
      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1 text-xs text-muted">
        <Link href="/" className="hover:text-gold-700">Home</Link>
        <ChevronRight className="size-3" aria-hidden="true" />
        <Link href="/properties" className="hover:text-gold-700">Properties</Link>
        <ChevronRight className="size-3" aria-hidden="true" />
        <span className="text-ink">{property.title}</span>
      </nav>

      {!isLive && (
        <div className="mb-5">
          <Notice tone="warning">
            <strong>Preview.</strong> This listing is “{LISTING_STATUS_LABEL[property.status]}” and is not visible to guests.
          </Notice>
        </div>
      )}

      <Gallery images={property.images.map((image) => ({ url: image.url, alt: image.alt }))} title={property.title} />

      <BookingProvider
        config={{
          slug: property.slug,
          currency: property.currency,
          nightlyPriceCents: property.nightlyPriceCents,
          cleaningFeeCents: property.cleaningFeeCents,
          serviceFeeBps: settings.serviceFeeRateBps,
          maxGuests: property.maxGuests,
          minNights: property.minNights,
          maxNights: property.maxNights,
          today,
          unavailable,
          instantBook: property.instantBook,
          bookable: isLive && !isOwnListing && property.payAtPropertyEnabled,
        }}
        initial={{ checkIn: datesValid ? checkIn : null, checkOut: datesValid ? checkOut : null, adults: guests, children: 0 }}
      >
        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px]">
          <div className="min-w-0">
            <p className="eyebrow mb-2">{property.category?.name ?? "Stay"}</p>
            <h1 className="heading-serif text-3xl leading-tight sm:text-[40px]">{property.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
              <span className="flex items-center gap-1.5">
                <MapPin className="size-4 text-gold-600" aria-hidden="true" />
                {[property.region, property.city, property.country].filter(Boolean).join(", ")}
              </span>
              <Rating value={property.ratingAvg} count={property.ratingCount} />
              {property.instantBook && (
                <span className="flex items-center gap-1 text-xs font-semibold text-gold-700">
                  <Zap className="size-3.5" aria-hidden="true" /> Instant confirmation
                </span>
              )}
            </div>

            <ul className="mt-6 grid grid-cols-2 gap-3 border-y border-cream-200 py-5 sm:grid-cols-4">
              {facts.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2.5 text-sm font-medium text-ink">
                  <Icon className="size-5 text-gold-600" aria-hidden="true" /> {label}
                </li>
              ))}
            </ul>

            <section className="pt-8" aria-labelledby="about">
              <h2 id="about" className="heading-serif mb-3 text-2xl">About this property</h2>
              <div className="space-y-4 text-[15px] leading-7 text-muted">
                {property.description.split(/\n{2,}/).map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            </section>

            {property.amenities.length > 0 && (
              <section className="pt-10" aria-labelledby="amenities">
                <h2 id="amenities" className="heading-serif mb-4 text-2xl">Amenities</h2>
                <ul className="grid grid-cols-2 gap-x-6 gap-y-3.5 sm:grid-cols-3">
                  {property.amenities.map(({ amenity }) => (
                    <li key={amenity.id} className="flex items-center gap-3 text-sm text-ink">
                      <AmenityIcon icon={amenity.icon} className="size-5 text-gold-600" /> {amenity.label}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {sleeping.length > 0 && (
              <section className="pt-10" aria-labelledby="sleeping">
                <h2 id="sleeping" className="heading-serif mb-4 text-2xl">Sleeping arrangements</h2>
                <ul className="grid gap-3 sm:grid-cols-3">
                  {sleeping.map((room, index) => (
                    <li key={index} className="rounded-xl border border-cream-200 bg-white p-4">
                      <BedDouble className="mb-2 size-5 text-gold-600" aria-hidden="true" />
                      <p className="text-sm font-semibold text-ink">{room.room}</p>
                      <p className="text-xs text-muted">{room.beds}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section id="availability" className="scroll-mt-24 pt-10" aria-labelledby="availability-title">
              <h2 id="availability-title" className="heading-serif mb-1 text-2xl">Availability</h2>
              <p className="mb-5 text-sm text-muted">
                Dates are shown in the property&apos;s local time ({property.timezone.replace(/_/g, " ")}). Minimum stay: {property.minNights} night{property.minNights === 1 ? "" : "s"}.
              </p>
              <div className="card card-pad">
                <AvailabilityCalendar />
              </div>
            </section>

            <section className="pt-10" aria-labelledby="rules">
              <h2 id="rules" className="heading-serif mb-4 text-2xl">Things to know</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-cream-200 bg-white p-5">
                  <Clock className="mb-3 size-5 text-gold-600" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-ink">Check-in &amp; check-out</h3>
                  <p className="mt-2 text-sm text-muted">Check-in from {property.checkInFrom}</p>
                  <p className="text-sm text-muted">Check-out by {property.checkOutBy}</p>
                </div>
                <div className="rounded-xl border border-cream-200 bg-white p-5">
                  <ScrollText className="mb-3 size-5 text-gold-600" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-ink">House rules</h3>
                  <ul className="mt-2 space-y-1 text-sm text-muted">
                    {property.houseRules.length ? property.houseRules.map((rule) => <li key={rule}>{rule}</li>) : <li>No additional rules.</li>}
                  </ul>
                </div>
                <div className="rounded-xl border border-cream-200 bg-white p-5">
                  <CalendarCheck className="mb-3 size-5 text-gold-600" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-ink">Cancellation — {policy.label}</h3>
                  <p className="mt-2 text-sm text-muted">{policy.summary}</p>
                  <Link href="/cancellation-policy" className="mt-2 inline-block text-xs font-semibold text-gold-700 hover:underline">
                    Read the full policy
                  </Link>
                </div>
              </div>
            </section>

            <section className="pt-10" aria-labelledby="location">
              <h2 id="location" className="heading-serif mb-3 text-2xl">Location</h2>
              <div className="flex items-start gap-3 rounded-xl border border-cream-200 bg-white p-5">
                <MapPin className="mt-0.5 size-5 shrink-0 text-gold-600" aria-hidden="true" />
                <div className="text-sm">
                  <p className="font-semibold text-ink">{[property.region, property.city].filter(Boolean).join(", ")}</p>
                  <p className="text-muted">{property.country}</p>
                  <p className="mt-2 text-xs text-muted">The exact address is shared in your booking details once you reserve.</p>
                </div>
              </div>
            </section>

            <section className="pt-10" aria-labelledby="reviews">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <h2 id="reviews" className="heading-serif text-2xl">Guest reviews</h2>
                {property.ratingCount > 0 && (
                  <p className="flex items-center gap-2">
                    <span className="font-serif text-3xl font-semibold text-ink">{property.ratingAvg.toFixed(1)}</span>
                    <span>
                      <Stars rating={property.ratingAvg} />
                      <span className="block text-xs text-muted">{property.ratingCount} verified review{property.ratingCount === 1 ? "" : "s"}</span>
                    </span>
                  </p>
                )}
              </div>
              {reviews.length === 0 ? (
                <p className="rounded-xl border border-cream-200 bg-white p-5 text-sm text-muted">
                  No reviews yet. Reviews can only be left by guests who have completed a stay here.
                </p>
              ) : (
                <ul className="grid gap-4 sm:grid-cols-2">
                  {reviews.map((review) => (
                    <li key={review.id} className="rounded-xl border border-cream-200 bg-white p-5">
                      <div className="flex items-center gap-3">
                        <Avatar name={review.author?.name ?? review.authorName ?? "Guest"} />
                        <div>
                          <p className="text-sm font-semibold text-ink">{review.author?.name ?? review.authorName ?? "Guest"}</p>
                          <p className="text-xs text-muted">
                            {review.author?.country ? `${review.author.country} · ` : ""}
                            {formatDate(review.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <Stars rating={review.rating} className="size-3.5" />
                      </div>
                      <p className="mt-2 text-sm leading-6 text-muted">{review.comment}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <BookingPanel>
              <WishlistButton propertyId={property.id} variant="button" />
            </BookingPanel>
            {isOwnListing && <Notice>This is your listing, so it cannot be booked from your account.</Notice>}

            <div className="card card-pad">
              <h2 className="mb-4 text-sm font-semibold text-ink">Host Information</h2>
              <div className="flex items-center gap-3">
                <Avatar name={property.owner.name} className="size-12 text-base" />
                <div>
                  <p className="text-sm font-semibold text-ink">{property.owner.name}</p>
                  <p className="text-xs text-muted">
                    On HAVORA since {property.owner.createdAt.getUTCFullYear()}
                    {property.owner.country ? ` · ${property.owner.country}` : ""}
                  </p>
                </div>
              </div>
              {property.owner.bio && <p className="mt-3 text-sm leading-6 text-muted">{property.owner.bio}</p>}
              <p className="mt-3 border-t border-cream-200 pt-3 text-xs text-muted">
                {property.owner._count.properties} active listing{property.owner._count.properties === 1 ? "" : "s"} on HAVORA
              </p>
            </div>
          </aside>
        </div>
      </BookingProvider>

      {similar.length > 0 && (
        <section className="pt-16">
          <SectionHeading title="Similar properties" subtitle="More stays you might like." href="/properties" />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {similar.map((item) => (
              <PropertyCard key={item.id} property={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
