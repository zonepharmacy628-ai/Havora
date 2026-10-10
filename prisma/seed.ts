/**
 * Database seed.
 *
 *   npm run db:seed
 *
 * Always (idempotent): amenities, platform settings, the administrator account.
 * Only when the database has no properties yet: DEMO owners, customers,
 * listings, past stays and reviews so the site can be explored end to end.
 * Demo accounts use @havora.test addresses — delete them before a real launch
 * (see README → "Going live with real data").
 *
 * Passwords come from environment variables and are never hard-coded.
 */
import "dotenv/config";
import { PrismaClient, type CancellationPolicy, type PropertyType, type Role } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { addDays, parseDate, toIso } from "../src/lib/dates";
import { calculateQuote } from "../src/lib/pricing";
import { generateBookingReference } from "../src/lib/bookings";
import { DEFAULT_SETTINGS, SETTING_KEYS } from "../src/lib/settings-core";

const prisma = new PrismaClient();
const img = (id: string) => `https://images.unsplash.com/photo-${id}`;

const AMENITIES = [
  { key: "wifi", label: "Wi-Fi", icon: "wifi", category: "Essentials" },
  { key: "pool", label: "Pool", icon: "waves", category: "Outdoors" },
  { key: "parking", label: "Parking", icon: "car", category: "Essentials" },
  { key: "kitchen", label: "Kitchen", icon: "utensils", category: "Essentials" },
  { key: "air_conditioning", label: "Air conditioning", icon: "snowflake", category: "Essentials" },
  { key: "gym", label: "Gym", icon: "dumbbell", category: "Wellness" },
  { key: "pet_friendly", label: "Pet friendly", icon: "paw", category: "Policies" },
  { key: "ocean_view", label: "Ocean view", icon: "sunset", category: "Outdoors" },
  { key: "hot_tub", label: "Hot tub", icon: "bath", category: "Wellness" },
  { key: "fireplace", label: "Fireplace", icon: "flame", category: "Comfort" },
  { key: "breakfast", label: "Breakfast included", icon: "coffee", category: "Services" },
  { key: "workspace", label: "Dedicated workspace", icon: "laptop", category: "Comfort" },
  { key: "washer", label: "Washer", icon: "shirt", category: "Essentials" },
  { key: "beach_access", label: "Beach access", icon: "umbrella", category: "Outdoors" },
  { key: "concierge", label: "Concierge", icon: "bell", category: "Services" },
  { key: "spa", label: "Spa", icon: "sparkles", category: "Wellness" },
];

type DemoProperty = {
  owner: number;
  title: string;
  summary: string;
  type: PropertyType;
  city: string;
  region?: string;
  country: string;
  countryCode: string;
  timezone: string;
  addressLine: string;
  price: number;
  cleaning: number;
  guests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  amenities: string[];
  images: string[];
  policy: CancellationPolicy;
  instantBook?: boolean;
  featured?: boolean;
  pending?: boolean;
  lat: number;
  lng: number;
};

const DEMO_PROPERTIES: DemoProperty[] = [
  {
    owner: 0, title: "Luxury Villa with Private Pool", type: "VILLA", featured: true,
    summary: "A serene Balinese villa wrapped in jungle, with a private pool and open-air living.",
    city: "Bali", region: "Ubud", country: "Indonesia", countryCode: "ID", timezone: "Asia/Makassar", addressLine: "Jalan Raya Sanggingan 12",
    price: 185, cleaning: 65, guests: 8, bedrooms: 4, beds: 5, bathrooms: 4, policy: "MODERATE", lat: -8.4905, lng: 115.2537,
    amenities: ["wifi", "pool", "parking", "kitchen", "air_conditioning", "ocean_view", "breakfast", "concierge"],
    images: ["1582268611958-ebfd161ef9cf", "1613490493576-7fde63acd811", "1540518614846-7eded433c457", "1584622650111-993a426fbf0a", "1615880484746-a134be9a6ecf"],
  },
  {
    owner: 1, title: "Modern City Apartment", type: "APARTMENT", featured: true,
    summary: "A bright, design-led apartment moments from the marina, dining and the metro.",
    city: "Dubai", country: "United Arab Emirates", countryCode: "AE", timezone: "Asia/Dubai", addressLine: "Marina Promenade, Tower 3",
    price: 95, cleaning: 35, guests: 3, bedrooms: 1, beds: 2, bathrooms: 1, policy: "FLEXIBLE", lat: 25.0805, lng: 55.1403,
    amenities: ["wifi", "parking", "kitchen", "air_conditioning", "gym", "workspace", "washer"],
    images: ["1522708323590-d24dbb6b0267", "1502672260266-1c1ef2d93688", "1556911220-bff31c812dba", "1512453979798-5ea266f8880c"],
  },
  {
    owner: 2, title: "Beach House with Ocean View", type: "BEACH_HOUSE", featured: true,
    summary: "Step from your deck into a turquoise lagoon at this light-filled island beach house.",
    city: "Maldives", region: "North Malé Atoll", country: "Maldives", countryCode: "MV", timezone: "Indian/Maldives", addressLine: "Lagoon Walk 4",
    price: 220, cleaning: 60, guests: 4, bedrooms: 2, beds: 2, bathrooms: 2, policy: "MODERATE", lat: 4.2105, lng: 73.5407,
    amenities: ["wifi", "air_conditioning", "ocean_view", "beach_access", "breakfast", "spa"],
    images: ["1499793983690-e29da59ef1c2", "1514282401047-d79a71a590e8", "1602002418082-a4443e081dd1", "1505693416388-ac5ce068fe85"],
  },
  {
    owner: 0, title: "Mountain Cabin", type: "CABIN", featured: true, instantBook: false,
    summary: "A timber hideaway with a wood-burning fireplace and wide alpine views.",
    city: "Zermatt", region: "Valais", country: "Switzerland", countryCode: "CH", timezone: "Europe/Zurich", addressLine: "Bergweg 8",
    price: 175, cleaning: 50, guests: 6, bedrooms: 3, beds: 4, bathrooms: 2, policy: "STRICT", lat: 46.0207, lng: 7.7491,
    amenities: ["wifi", "parking", "kitchen", "fireplace", "hot_tub", "pet_friendly"],
    images: ["1510798831971-661eb04b3739", "1449158743715-0a90ebb6d2d8", "1518780664697-55e3ad937233"],
  },
  {
    owner: 1, title: "Tropical Villa Retreat", type: "VILLA",
    summary: "Contemporary tropical living with a lap pool, shaded terraces and a private chef on request.",
    city: "Phuket", country: "Thailand", countryCode: "TH", timezone: "Asia/Bangkok", addressLine: "Soi Kamala 21",
    price: 160, cleaning: 55, guests: 6, bedrooms: 3, beds: 3, bathrooms: 3, policy: "MODERATE", lat: 7.9519, lng: 98.2814,
    amenities: ["wifi", "pool", "parking", "kitchen", "air_conditioning", "gym"],
    images: ["1613977257363-707ba9348227", "1600596542815-ffad4c1539a9", "1600566753190-17f0baa2a6c3", "1600210492486-724fe5c67fb0"],
  },
  {
    owner: 2, title: "Cozy Beachfront House", type: "BEACH_HOUSE",
    summary: "A whitewashed Cycladic home above the caldera, made for slow mornings and sunsets.",
    city: "Santorini", region: "Oia", country: "Greece", countryCode: "GR", timezone: "Europe/Athens", addressLine: "Nikolaou Nomikou 17",
    price: 140, cleaning: 45, guests: 4, bedrooms: 2, beds: 2, bathrooms: 1, policy: "FLEXIBLE", lat: 36.4618, lng: 25.3753,
    amenities: ["wifi", "kitchen", "air_conditioning", "ocean_view", "beach_access"],
    images: ["1570077188670-e3a8d69ac5ff", "1613395877344-13d4a8e0d49e", "1533105079780-92b9be482077"],
  },
  {
    owner: 0, title: "Infinity Pool Cliff Villa", type: "VILLA",
    summary: "A dramatic clifftop villa where the infinity pool meets the Indian Ocean horizon.",
    city: "Bali", region: "Uluwatu", country: "Indonesia", countryCode: "ID", timezone: "Asia/Makassar", addressLine: "Jalan Pantai Suluban 5",
    price: 310, cleaning: 90, guests: 10, bedrooms: 5, beds: 6, bathrooms: 5, policy: "STRICT", lat: -8.8149, lng: 115.0884,
    amenities: ["wifi", "pool", "parking", "kitchen", "air_conditioning", "ocean_view", "gym", "concierge", "spa"],
    images: ["1540541338287-41700207dee6", "1571896349842-33c89424de2d", "1600585154340-be6161a56a0c", "1600607687939-ce8a6c25118c"],
  },
  {
    owner: 1, title: "Grand Palm Resort Suite", type: "RESORT",
    summary: "A generous resort suite with palm-lined pools, a private beach and five-star service.",
    city: "Dubai", country: "United Arab Emirates", countryCode: "AE", timezone: "Asia/Dubai", addressLine: "Palm Crescent East 9",
    price: 260, cleaning: 0, guests: 3, bedrooms: 1, beds: 1, bathrooms: 1, policy: "MODERATE", lat: 25.1124, lng: 55.139,
    amenities: ["wifi", "pool", "parking", "air_conditioning", "gym", "beach_access", "breakfast", "concierge", "spa"],
    images: ["1520250497591-112f2f40a3f4", "1566073771259-6a8506099945", "1582719508461-905c673771fd", "1455587734955-081b22074882"],
  },
  {
    owner: 2, title: "Boutique Hotel Suite", type: "HOTEL",
    summary: "An elegant Haussmann-era suite a short stroll from the Seine and the Eiffel Tower.",
    city: "Paris", country: "France", countryCode: "FR", timezone: "Europe/Paris", addressLine: "14 Avenue de la Bourdonnais",
    price: 240, cleaning: 0, guests: 2, bedrooms: 1, beds: 1, bathrooms: 1, policy: "FLEXIBLE", lat: 48.8566, lng: 2.2986,
    amenities: ["wifi", "air_conditioning", "breakfast", "concierge", "workspace"],
    images: ["1611892440504-42a792e24d32", "1502602898657-3e91760cbb34", "1542314831-068cd1dbfeeb", "1578683010236-d716f9a3f461"],
  },
  {
    owner: 1, title: "Skyline Penthouse Apartment", type: "APARTMENT",
    summary: "Floor-to-ceiling views of the downtown skyline from a two-level penthouse.",
    city: "Dubai", country: "United Arab Emirates", countryCode: "AE", timezone: "Asia/Dubai", addressLine: "Boulevard Heights, Level 48",
    price: 330, cleaning: 80, guests: 6, bedrooms: 3, beds: 4, bathrooms: 3, policy: "STRICT", lat: 25.1972, lng: 55.2744,
    amenities: ["wifi", "pool", "parking", "kitchen", "air_conditioning", "gym", "workspace", "washer", "concierge"],
    images: ["1493809842364-78817add7ffb", "1560448204-e02f11c3d0e2", "1484154218962-a197022b5858", "1518684079-3c830dcef090"],
  },
  {
    owner: 0, title: "Lakeside Timber Lodge", type: "CABIN",
    summary: "A peaceful lodge on the water's edge with a private jetty and mountain backdrop.",
    city: "Interlaken", region: "Bern", country: "Switzerland", countryCode: "CH", timezone: "Europe/Zurich", addressLine: "Seestrasse 31",
    price: 205, cleaning: 55, guests: 5, bedrooms: 2, beds: 3, bathrooms: 2, policy: "MODERATE", lat: 46.6863, lng: 7.8632,
    amenities: ["wifi", "parking", "kitchen", "fireplace", "pet_friendly", "washer"],
    images: ["1439066615861-d1af74d74000", "1501785888041-af3ef285b470", "1470770841072-f978cf4d019e", "1505691938895-1758d7feb511"],
  },
  {
    owner: 2, title: "Overwater Lagoon Villa", type: "RESORT",
    summary: "A private overwater villa with a glass floor, sundeck and direct lagoon access.",
    city: "Maldives", region: "Baa Atoll", country: "Maldives", countryCode: "MV", timezone: "Indian/Maldives", addressLine: "Sunset Jetty 2",
    price: 480, cleaning: 0, guests: 2, bedrooms: 1, beds: 1, bathrooms: 1, policy: "STRICT", lat: 5.1561, lng: 72.9685,
    amenities: ["wifi", "pool", "air_conditioning", "ocean_view", "beach_access", "breakfast", "concierge", "spa"],
    images: ["1573843981267-be1999ff37cd", "1506929562872-bb421503ef21", "1507525428034-b723cf961d3e", "1544161515-4ab6ce6db874"],
  },
  {
    owner: 2, title: "Hillside Garden Villa", type: "VILLA", pending: true,
    summary: "A newly renovated villa with terraced gardens and an outdoor dining pavilion.",
    city: "Santorini", region: "Imerovigli", country: "Greece", countryCode: "GR", timezone: "Europe/Athens", addressLine: "Agiou Georgiou 3",
    price: 195, cleaning: 60, guests: 6, bedrooms: 3, beds: 3, bathrooms: 2, policy: "MODERATE", lat: 36.4329, lng: 25.4226,
    amenities: ["wifi", "pool", "parking", "kitchen", "air_conditioning"],
    images: ["1580587771525-78b9dba3b914", "1564013799919-ab600027ffc6", "1512917774080-9991f1c4c750", "1568605114967-8130f3a36994"],
  },
];

const DEMO_REVIEWS = [
  { rating: 5, comment: "Exactly as pictured. Spotless on arrival, a very comfortable bed and a host who answered every question within minutes." },
  { rating: 5, comment: "One of the best stays we have had. The location is superb and check-in was effortless. We would happily return." },
  { rating: 4, comment: "A lovely, well-equipped place. A little further from the centre than we expected, but the views more than made up for it." },
  { rating: 5, comment: "Beautifully designed and thoughtfully prepared for guests. The small touches on arrival made a real difference." },
  { rating: 4, comment: "Great value for the quality. Clean, quiet and comfortable — the Wi-Fi dropped once but was fixed quickly." },
  { rating: 5, comment: "A truly relaxing week. Everything worked, the kitchen had all we needed and the host's local tips were excellent." },
];

function describe(p: DemoProperty): string {
  return [
    `${p.summary}`,
    `Set in ${p.region ? `${p.region}, ` : ""}${p.city}, this ${p.bedrooms}-bedroom ${p.type.toLowerCase().replace("_", " ")} comfortably hosts up to ${p.guests} guests. Interiors are finished to a high standard with quality linens, considered lighting and generous living space for gathering together.`,
    `Your host is on hand before and during your stay to help with arrival, local recommendations and anything else you need. Payment is made directly at the property on arrival — nothing is charged online when you reserve.`,
  ].join("\n\n");
}

function sleeping(p: DemoProperty) {
  return Array.from({ length: Math.max(p.bedrooms, 1) }, (_, i) => ({
    room: p.bedrooms <= 1 ? "Bedroom" : `Bedroom ${i + 1}`,
    beds: i === 0 ? "1 king bed" : i < p.beds - p.bedrooms + 1 ? "2 single beds" : "1 queen bed",
  }));
}

async function upsertUser(input: { email: string; name: string; role: Role; password: string; country?: string; bio?: string }) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) return existing;
  const user = await prisma.user.create({
    data: { email: input.email, name: input.name, role: input.role, emailVerified: true, country: input.country, bio: input.bio },
  });
  await prisma.account.create({
    data: { userId: user.id, accountId: user.id, providerId: "credential", password: await hashPassword(input.password) },
  });
  return user;
}

function requirePassword(name: string): string {
  const value = process.env[name];
  if (!value || value.length < 10 || value.startsWith("replace-with")) {
    throw new Error(`${name} must be set in .env to a real password of at least 10 characters before seeding.`);
  }
  return value;
}

async function main() {
  // ── Reference data ──
  for (const amenity of AMENITIES) {
    await prisma.amenity.upsert({ where: { key: amenity.key }, update: { label: amenity.label, icon: amenity.icon, category: amenity.category }, create: amenity });
  }
  const defaults: Record<string, string> = {
    [SETTING_KEYS.commissionRateBps]: String(DEFAULT_SETTINGS.commissionRateBps),
    [SETTING_KEYS.serviceFeeRateBps]: String(DEFAULT_SETTINGS.serviceFeeRateBps),
    [SETTING_KEYS.requireListingApproval]: String(DEFAULT_SETTINGS.requireListingApproval),
    [SETTING_KEYS.supportEmail]: DEFAULT_SETTINGS.supportEmail,
    [SETTING_KEYS.announcement]: "",
  };
  for (const [key, value] of Object.entries(defaults)) {
    await prisma.platformSetting.upsert({ where: { key }, update: {}, create: { key, value } });
  }
  console.log(`✓ ${AMENITIES.length} amenities and platform settings`);

  // ── Administrator ──
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail) throw new Error("SEED_ADMIN_EMAIL must be set in .env before seeding.");
  await upsertUser({ email: adminEmail, name: "HAVORA Admin", role: "ADMIN", password: requirePassword("SEED_ADMIN_PASSWORD") });
  console.log(`✓ Administrator account: ${adminEmail}`);

  if (process.argv.includes("--no-demo") || process.env.SEED_DEMO === "false") {
    console.log("Skipping demo content (--no-demo).");
    return;
  }
  if ((await prisma.property.count()) > 0) {
    console.log("Properties already exist — demo content left untouched.");
    return;
  }

  // ── Demo accounts ──
  const demoPassword = requirePassword("SEED_DEMO_PASSWORD");
  const owners = await Promise.all(
    [
      { email: "sarah.owner@havora.test", name: "Sarah Johnson", country: "Indonesia", bio: "Hospitality professional hosting design-led homes with a personal welcome." },
      { email: "omar.owner@havora.test", name: "Omar Haddad", country: "United Arab Emirates", bio: "Property manager focused on effortless city and resort stays." },
      { email: "elena.owner@havora.test", name: "Elena Markou", country: "Greece", bio: "Island host who loves sharing quiet corners and local tables." },
    ].map((o) => upsertUser({ ...o, role: "OWNER", password: demoPassword })),
  );
  const customers = await Promise.all(
    [
      { email: "john.customer@havora.test", name: "John Smith", country: "United Kingdom" },
      { email: "amelia.customer@havora.test", name: "Amelia Chen", country: "Singapore" },
      { email: "lucas.customer@havora.test", name: "Lucas Meyer", country: "Germany" },
      { email: "priya.customer@havora.test", name: "Priya Nair", country: "India" },
    ].map((c) => upsertUser({ ...c, role: "CUSTOMER", password: demoPassword })),
  );
  console.log(`✓ ${owners.length} demo owners and ${customers.length} demo customers (@havora.test)`);

  // ── Demo listings, past stays and reviews ──
  // The six starter categories are created by the database migration.
  const starterCategories = await prisma.category.findMany({ where: { id: { startsWith: "cat_" } }, select: { id: true } });
  const categoryByType = new Map(starterCategories.map((c) => [c.id.replace("cat_", "").toUpperCase(), c.id]));
  const amenityByKey = new Map((await prisma.amenity.findMany()).map((a) => [a.key, a.id]));
  const today = toIso(new Date());
  let reviewIndex = 0;

  for (const [index, p] of DEMO_PROPERTIES.entries()) {
    const slug = p.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const property = await prisma.property.create({
      data: {
        ownerId: owners[p.owner].id,
        slug,
        title: p.title,
        summary: p.summary,
        description: describe(p),
        type: p.type,
        categoryId: categoryByType.get(p.type) ?? null,
        status: p.pending ? "PENDING_REVIEW" : "PUBLISHED",
        publishedAt: p.pending ? null : new Date(),
        featured: Boolean(p.featured),
        addressLine: p.addressLine,
        city: p.city,
        region: p.region,
        country: p.country,
        countryCode: p.countryCode,
        latitude: p.lat,
        longitude: p.lng,
        timezone: p.timezone,
        nightlyPriceCents: p.price * 100,
        cleaningFeeCents: p.cleaning * 100,
        maxGuests: p.guests,
        bedrooms: p.bedrooms,
        beds: p.beds,
        bathrooms: p.bathrooms,
        sleepingArrangements: sleeping(p),
        houseRules: ["No smoking indoors", "No parties or events", "Quiet hours from 22:00 to 07:00", "Respect the neighbours and the property"],
        minNights: p.type === "HOTEL" || p.type === "APARTMENT" ? 1 : 2,
        maxNights: 30,
        instantBook: p.instantBook ?? true,
        cancellationPolicy: p.policy,
        images: { create: p.images.map((id, position) => ({ url: img(id), alt: `${p.title} — photo ${position + 1}`, position })) },
        amenities: { create: p.amenities.map((key) => ({ amenityId: amenityByKey.get(key)! })) },
      },
    });
    if (p.pending) continue;

    // Completed demo stays in the past, each with a published demo review.
    const stays = 2 + (index % 3);
    for (let s = 0; s < stays; s++) {
      const nights = 3 + ((index + s) % 4);
      const checkIn = addDays(today, -(20 + s * 24 + index * 3 + nights));
      const checkOut = addDays(checkIn, nights);
      const customer = customers[(index + s) % customers.length];
      const quote = calculateQuote({
        nightlyPriceCents: property.nightlyPriceCents,
        cleaningFeeCents: property.cleaningFeeCents,
        nights,
        serviceFeeBps: DEFAULT_SETTINGS.serviceFeeRateBps,
        commissionBps: DEFAULT_SETTINGS.commissionRateBps,
      });
      const review = DEMO_REVIEWS[reviewIndex++ % DEMO_REVIEWS.length];
      const stayEnd = new Date(parseDate(checkOut).getTime() + 11 * 3_600_000);
      await prisma.booking.create({
        data: {
          reference: generateBookingReference(),
          propertyId: property.id,
          customerId: customer.id,
          checkIn: parseDate(checkIn),
          checkOut: parseDate(checkOut),
          adults: 2,
          children: 0,
          status: "COMPLETED",
          currency: "USD",
          ...quote,
          contactName: customer.name,
          contactEmail: customer.email,
          contactPhone: "+1 555 010 0100",
          cancellationPolicy: property.cancellationPolicy,
          createdAt: new Date(parseDate(checkIn).getTime() - 14 * 86_400_000),
          guests: { create: [{ fullName: customer.name, isPrimary: true }] },
          payments: {
            create: { method: "PAY_AT_PROPERTY", status: "PAID", amountCents: quote.totalCents, currency: "USD", paidAt: stayEnd, note: "Demo data — collected at property" },
          },
          review: {
            create: { propertyId: property.id, authorId: customer.id, rating: review.rating, comment: review.comment, createdAt: new Date(stayEnd.getTime() + 86_400_000) },
          },
        },
      });
    }
    const stats = await prisma.review.aggregate({ where: { propertyId: property.id }, _avg: { rating: true }, _count: { _all: true } });
    await prisma.property.update({
      where: { id: property.id },
      data: { ratingAvg: Math.round((stats._avg.rating ?? 0) * 100) / 100, ratingCount: stats._count._all },
    });
  }
  console.log(`✓ ${DEMO_PROPERTIES.length} demo listings with past stays and reviews`);
  console.log("\nSeed complete. Sign in with SEED_ADMIN_EMAIL, or any @havora.test demo account using SEED_DEMO_PASSWORD.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
