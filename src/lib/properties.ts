import "server-only";
import { Prisma } from "@prisma/client";
import { ACTIVE_BOOKING_STATUSES } from "./booking-rules";
import { DESTINATION_IMAGES, PAGE_SIZE, SORT_OPTIONS, type SortValue } from "./constants";
import { isIsoDate, parseDate } from "./dates";
import { prisma } from "./prisma";

export type SearchParams = Record<string, string | string[] | undefined>;

export type PropertyFilters = {
  q: string;
  checkIn: string | null;
  checkOut: string | null;
  guests: number;
  /** Category slugs. */
  categories: string[];
  minPrice: number | null;
  maxPrice: number | null;
  amenities: string[];
  rating: number | null;
  sort: SortValue;
  page: number;
};

const list = (value: string | string[] | undefined): string[] =>
  (Array.isArray(value) ? value : value ? value.split(",") : []).map((v) => v.trim()).filter(Boolean);

const first = (value: string | string[] | undefined): string => (Array.isArray(value) ? value[0] : value) ?? "";

const positiveInt = (value: string, max: number): number | null => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= max ? parsed : null;
};

/** Parses and sanitises URL search params into typed filters. */
export function parseFilters(params: SearchParams): PropertyFilters {
  const checkIn = first(params.checkIn);
  const checkOut = first(params.checkOut);
  const datesValid = isIsoDate(checkIn) && isIsoDate(checkOut) && checkOut > checkIn;
  const sort = first(params.sort) as SortValue;
  const rating = positiveInt(first(params.rating), 5);

  return {
    q: first(params.q).trim().slice(0, 80),
    checkIn: datesValid ? checkIn : null,
    checkOut: datesValid ? checkOut : null,
    guests: positiveInt(first(params.guests), 30) ?? 1,
    // `type=VILLA` is the old form of this filter; it still works so existing links don't break.
    categories: [...list(params.category), ...list(params.type).map((t) => t.toLowerCase().replace(/_/g, "-"))]
      .filter((slug) => /^[a-z0-9-]{1,60}$/.test(slug))
      .slice(0, 20),
    minPrice: positiveInt(first(params.minPrice), 100_000),
    maxPrice: positiveInt(first(params.maxPrice), 100_000),
    amenities: list(params.amenity).slice(0, 12),
    rating,
    sort: SORT_OPTIONS.some((o) => o.value === sort) ? sort : "popular",
    page: positiveInt(first(params.page), 500) ?? 1,
  };
}

export function buildWhere(filters: PropertyFilters): Prisma.PropertyWhereInput {
  const and: Prisma.PropertyWhereInput[] = [{ status: "PUBLISHED" }, { owner: { status: "ACTIVE" } }];

  if (filters.q) {
    const contains = { contains: filters.q, mode: "insensitive" as const };
    and.push({ OR: [{ city: contains }, { country: contains }, { region: contains }, { title: contains }] });
  }
  if (filters.guests > 1) and.push({ maxGuests: { gte: filters.guests } });
  if (filters.categories.length) and.push({ category: { slug: { in: filters.categories } } });
  if (filters.minPrice) and.push({ nightlyPriceCents: { gte: filters.minPrice * 100 } });
  if (filters.maxPrice) and.push({ nightlyPriceCents: { lte: filters.maxPrice * 100 } });
  if (filters.rating) and.push({ ratingAvg: { gte: filters.rating }, ratingCount: { gt: 0 } });
  for (const key of filters.amenities) and.push({ amenities: { some: { amenity: { key } } } });

  if (filters.checkIn && filters.checkOut) {
    const start = parseDate(filters.checkIn);
    const end = parseDate(filters.checkOut);
    and.push({
      bookings: { none: { status: { in: ACTIVE_BOOKING_STATUSES }, checkIn: { lt: end }, checkOut: { gt: start } } },
      blocks: { none: { startDate: { lt: end }, endDate: { gt: start } } },
    });
  }
  return { AND: and };
}

const ORDER: Record<SortValue, Prisma.PropertyOrderByWithRelationInput[]> = {
  popular: [{ ratingCount: "desc" }, { ratingAvg: "desc" }, { createdAt: "desc" }],
  rating: [{ ratingAvg: "desc" }, { ratingCount: "desc" }],
  price_asc: [{ nightlyPriceCents: "asc" }],
  price_desc: [{ nightlyPriceCents: "desc" }],
};

export const cardSelect = {
  id: true,
  slug: true,
  title: true,
  category: { select: { name: true } },
  city: true,
  country: true,
  currency: true,
  nightlyPriceCents: true,
  ratingAvg: true,
  ratingCount: true,
  maxGuests: true,
  bedrooms: true,
  featured: true,
  images: { orderBy: { position: "asc" }, take: 1, select: { url: true, alt: true } },
} satisfies Prisma.PropertySelect;

export type PropertyCardData = Prisma.PropertyGetPayload<{ select: typeof cardSelect }>;

export async function searchProperties(filters: PropertyFilters) {
  const where = buildWhere(filters);
  const [total, items] = await Promise.all([
    prisma.property.count({ where }),
    prisma.property.findMany({
      where,
      orderBy: [...ORDER[filters.sort], { id: "asc" }],
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: cardSelect,
    }),
  ]);
  return { total, items, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

const publicWhere: Prisma.PropertyWhereInput = { status: "PUBLISHED", owner: { status: "ACTIVE" } };

export function getFeaturedProperties(take = 4) {
  return prisma.property.findMany({
    where: publicWhere,
    orderBy: [{ featured: "desc" }, { ratingAvg: "desc" }, { ratingCount: "desc" }],
    take,
    select: cardSelect,
  });
}

export function getRecommendedProperties(excludeIds: string[], take = 4) {
  return prisma.property.findMany({
    where: { ...publicWhere, id: { notIn: excludeIds } },
    orderBy: [{ ratingCount: "desc" }, { createdAt: "desc" }],
    take,
    select: cardSelect,
  });
}

/** Destinations ranked by number of live listings — real counts from the database. */
export async function getPopularDestinations(take = 5) {
  const groups = await prisma.property.groupBy({
    by: ["city", "country"],
    where: publicWhere,
    _count: { _all: true },
    orderBy: { _count: { city: "desc" } },
    take,
  });
  return Promise.all(
    groups.map(async (group) => {
      let image = DESTINATION_IMAGES[group.city.toLowerCase()];
      if (!image) {
        const sample = await prisma.propertyImage.findFirst({
          where: { property: { ...publicWhere, city: group.city } },
          orderBy: { position: "asc" },
          select: { url: true },
        });
        image = sample?.url ?? "";
      }
      return { city: group.city, country: group.country, count: group._count._all, image };
    }),
  );
}

/**
 * Properties a legacy account saved before the wishlist moved into the browser.
 * Read-only: the rows are kept, and imported once into the visitor's browser.
 */
export async function getLegacyWishlistIds(userId: string | undefined): Promise<string[]> {
  if (!userId) return [];
  const rows = await prisma.wishlist.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, select: { propertyId: true } });
  return rows.map((row) => row.propertyId);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function uniqueSlug(title: string): Promise<string> {
  const base = slugify(title) || "stay";
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    if (!(await prisma.property.findUnique({ where: { slug: candidate }, select: { id: true } }))) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}
