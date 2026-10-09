import "server-only";
import type { Prisma } from "@prisma/client";
import { REVENUE_BOOKING_STATUSES } from "./booking-rules";
import { lastMonths, monthKey, monthLabel } from "./dates";
import { prisma } from "./prisma";

/**
 * Monthly totals for bookings that count as revenue (confirmed, completed or
 * awaiting a cancellation decision), grouped by check-in month. All figures
 * are computed from real booking rows.
 */
export async function monthlyBookingTotals(where: Prisma.BookingWhereInput, months = 12) {
  const keys = lastMonths(months);
  const from = new Date(`${keys[0]}-01T00:00:00Z`);
  const rows = await prisma.booking.findMany({
    where: { ...where, status: { in: REVENUE_BOOKING_STATUSES }, checkIn: { gte: from } },
    select: { checkIn: true, totalCents: true, ownerEarningsCents: true, commissionCents: true, serviceFeeCents: true },
  });
  const buckets = new Map(keys.map((key) => [key, { bookings: 0, totalCents: 0, ownerEarningsCents: 0, platformCents: 0 }]));
  for (const row of rows) {
    const bucket = buckets.get(monthKey(row.checkIn));
    if (!bucket) continue;
    bucket.bookings += 1;
    bucket.totalCents += row.totalCents;
    bucket.ownerEarningsCents += row.ownerEarningsCents;
    bucket.platformCents += row.commissionCents + row.serviceFeeCents;
  }
  return keys.map((key) => ({ key, label: monthLabel(key), ...buckets.get(key)! }));
}

export async function revenueSummary(where: Prisma.BookingWhereInput) {
  const sums = await prisma.booking.aggregate({
    where: { ...where, status: { in: REVENUE_BOOKING_STATUSES } },
    _sum: { totalCents: true, subtotalCents: true, ownerEarningsCents: true, commissionCents: true, serviceFeeCents: true },
    _count: { _all: true },
  });
  return {
    bookings: sums._count._all,
    totalCents: sums._sum.totalCents ?? 0,
    subtotalCents: sums._sum.subtotalCents ?? 0,
    ownerEarningsCents: sums._sum.ownerEarningsCents ?? 0,
    commissionCents: sums._sum.commissionCents ?? 0,
    serviceFeeCents: sums._sum.serviceFeeCents ?? 0,
  };
}
