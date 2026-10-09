import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { Filters, SortSelect } from "@/components/filters";
import { PropertyCard } from "@/components/property-card";
import { SearchBar } from "@/components/search-bar";
import { EmptyState, Pagination } from "@/components/ui";
import { HERO_IMAGE, PAGE_SIZE } from "@/lib/constants";
import { formatDateRange, toIso } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { getTypeCounts, getWishlistIds, parseFilters, searchProperties, type SearchParams } from "@/lib/properties";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "Explore Properties",
  description: "Search handpicked villas, apartments, hotels and cabins by destination, dates, price and amenities.",
};

export default async function PropertiesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const raw = await searchParams;
  const filters = parseFilters(raw);
  const user = await getCurrentUser();
  const [{ items, total, pages }, amenities, typeCounts, wishlist] = await Promise.all([
    searchProperties(filters),
    prisma.amenity.findMany({ orderBy: { label: "asc" }, select: { key: true, label: true } }),
    getTypeCounts(),
    getWishlistIds(user?.id),
  ]);

  // Canonical query string for the current filters (used by sort + pagination links).
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.checkIn && filters.checkOut) {
    params.set("checkIn", filters.checkIn);
    params.set("checkOut", filters.checkOut);
  }
  if (filters.guests > 1) params.set("guests", String(filters.guests));
  if (filters.types.length) params.set("type", filters.types.join(","));
  if (filters.amenities.length) params.set("amenity", filters.amenities.join(","));
  if (filters.minPrice) params.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice) params.set("maxPrice", String(filters.maxPrice));
  if (filters.rating) params.set("rating", String(filters.rating));
  if (filters.sort !== "popular") params.set("sort", filters.sort);

  const hrefFor = (page: number) => {
    const next = new URLSearchParams(params);
    if (page > 1) next.set("page", String(page));
    return `/properties?${next.toString()}`;
  };

  // Dates and guests travel with the visitor to the details page.
  const stay = new URLSearchParams();
  if (filters.checkIn && filters.checkOut) {
    stay.set("checkIn", filters.checkIn);
    stay.set("checkOut", filters.checkOut);
  }
  if (filters.guests > 1) stay.set("guests", String(filters.guests));
  const stayQuery = stay.size ? `?${stay.toString()}` : "";

  const preserve: Record<string, string> = {};
  for (const key of ["type", "amenity", "minPrice", "maxPrice", "rating", "sort"]) {
    const value = params.get(key);
    if (value) preserve[key] = value;
  }

  const from = total === 0 ? 0 : (filters.page - 1) * PAGE_SIZE + 1;
  const to = Math.min(filters.page * PAGE_SIZE, total);

  return (
    <>
      <section className="relative isolate bg-navy-950">
        <Image src={HERO_IMAGE} alt="" fill priority sizes="100vw" className="-z-20 object-cover object-[center_60%]" />
        <div className="hero-overlay absolute inset-0 -z-10" />
        <div className="container-page pt-12 pb-16">
          <h1 className="font-serif text-4xl font-medium tracking-tight text-white sm:text-[44px]">Explore Our Properties</h1>
          <p className="mt-2 text-[15px] text-navy-200">Find your perfect stay from our handpicked collection.</p>
        </div>
      </section>

      <div className="container-page relative z-10 -mt-9">
        <SearchBar today={toIso(new Date())} defaults={filters} preserve={preserve} />
      </div>

      <div className="container-page grid gap-8 py-10 lg:grid-cols-[270px_1fr]">
        <aside>
          <Filters filters={filters} amenities={amenities} typeCounts={Object.fromEntries(typeCounts)} />
        </aside>

        <section aria-live="polite">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-muted">
              {total === 0 ? (
                "No properties found"
              ) : (
                <>
                  Showing <span className="font-semibold text-ink">{from}–{to}</span> of <span className="font-semibold text-ink">{total}</span>{" "}
                  propert{total === 1 ? "y" : "ies"}
                  {filters.q && <> for “{filters.q}”</>}
                  {filters.checkIn && filters.checkOut && <> · available {formatDateRange(filters.checkIn, filters.checkOut)}</>}
                </>
              )}
            </p>
            <SortSelect value={filters.sort} params={params.toString()} />
          </div>

          {items.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="No stays match your search"
              text="Try different dates, a wider price range or fewer filters to see more properties."
              action={
                <Link href="/properties" className="btn btn-gold">
                  Clear search
                </Link>
              }
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((property, index) => (
                <PropertyCard key={property.id} property={property} saved={wishlist.has(property.id)} query={stayQuery} showButton priority={index < 3} />
              ))}
            </div>
          )}
          <Pagination page={filters.page} pages={pages} hrefFor={hrefFor} />
        </section>
      </div>
    </>
  );
}
