/**
 * Removes the DEMO content created by `npm run db:seed`: every account with an
 * @havora.test email address, plus their listings, bookings, payments and reviews.
 * Real accounts, amenities, platform settings and the administrator are kept.
 *
 *   npm run db:remove-demo -- --yes
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DEMO = { email: { endsWith: "@havora.test" } };

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const demoUsers = await prisma.user.findMany({ where: { ...DEMO, NOT: { email: adminEmail ?? "" } }, select: { id: true, email: true } });
  if (demoUsers.length === 0) {
    console.log("No demo accounts found — nothing to remove.");
    return;
  }
  if (!process.argv.includes("--yes")) {
    console.log(`This will permanently delete ${demoUsers.length} demo accounts and all of their listings and bookings:`);
    for (const user of demoUsers) console.log(`  - ${user.email}`);
    console.log("\nRe-run with `-- --yes` to confirm.");
    return;
  }

  const ids = demoUsers.map((user) => user.id);
  const involved = { OR: [{ customerId: { in: ids } }, { property: { ownerId: { in: ids } } }] };
  const realBookings = await prisma.booking.count({
    where: { property: { ownerId: { in: ids } }, customerId: { notIn: ids } },
  });
  if (realBookings > 0) {
    throw new Error(`${realBookings} booking(s) by real customers exist on demo listings. Resolve those before removing demo data.`);
  }

  await prisma.$transaction([
    prisma.payout.deleteMany({ where: { ownerId: { in: ids } } }),
    prisma.booking.deleteMany({ where: involved }), // cascades to guests, payments and reviews
    prisma.property.deleteMany({ where: { ownerId: { in: ids } } }), // cascades to images, amenities, blocks, wishlists
    prisma.user.deleteMany({ where: { id: { in: ids } } }), // cascades to sessions and accounts
  ]);
  console.log(`Removed ${demoUsers.length} demo accounts and their data.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
