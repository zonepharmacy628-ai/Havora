import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { bookingListInclude, StatusTabs, TripList } from "@/components/booking-list";
import { EmptyState, PageHeader } from "@/components/ui";
import { completeFinishedStays } from "@/lib/bookings";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

const TABS: { value: string; label: string; where: Prisma.BookingWhereInput }[] = [
  { value: "", label: "Upcoming", where: { status: { in: ["PENDING", "CONFIRMED", "CANCELLATION_REQUESTED"] } } },
  { value: "completed", label: "Completed", where: { status: "COMPLETED" } },
  { value: "cancelled", label: "Cancelled", where: { status: { in: ["CANCELLED", "DECLINED", "NO_SHOW"] } } },
];

export default async function MyBookingsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await requireUser("/account/bookings");
  const { status = "" } = await searchParams;
  const tab = TABS.find((t) => t.value === status) ?? TABS[0];
  await completeFinishedStays(prisma, { customerId: user.id });

  const [bookings, counts] = await Promise.all([
    prisma.booking.findMany({
      where: { customerId: user.id, ...tab.where },
      orderBy: tab.value ? { checkIn: "desc" } : { checkIn: "asc" },
      include: bookingListInclude,
      take: 100,
    }),
    Promise.all(TABS.map((t) => prisma.booking.count({ where: { customerId: user.id, ...t.where } }))),
  ]);

  return (
    <>
      <PageHeader title="My Bookings" subtitle="View your trips, check payment status and manage cancellations." />
      <StatusTabs base="/account/bookings" current={tab.value} tabs={TABS.map((t, i) => ({ value: t.value, label: t.label, count: counts[i] }))} />
      {bookings.length > 0 ? (
        <TripList bookings={bookings} />
      ) : (
        <EmptyState
          icon={CalendarCheck}
          title={`No ${tab.label.toLowerCase()} bookings`}
          text="Your reservations will appear here."
          action={
            <Link href="/properties" className="btn btn-gold">
              Find a stay
            </Link>
          }
        />
      )}
    </>
  );
}
