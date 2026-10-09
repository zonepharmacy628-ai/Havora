import { CalendarCheck } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { bookingListInclude, ReservationTable, StatusTabs } from "@/components/booking-list";
import { EmptyState, PageHeader } from "@/components/ui";
import { completeFinishedStays } from "@/lib/bookings";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

const TABS: { value: string; label: string; where: Prisma.BookingWhereInput }[] = [
  { value: "", label: "All", where: {} },
  { value: "action", label: "Needs action", where: { status: { in: ["PENDING", "CANCELLATION_REQUESTED"] } } },
  { value: "confirmed", label: "Confirmed", where: { status: "CONFIRMED" } },
  { value: "completed", label: "Completed", where: { status: "COMPLETED" } },
  { value: "cancelled", label: "Cancelled", where: { status: { in: ["CANCELLED", "DECLINED", "NO_SHOW"] } } },
];

export default async function AdminBookingsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  await requireRole(["ADMIN"], "/admin/bookings");
  const { status = "", q = "" } = await searchParams;
  const tab = TABS.find((t) => t.value === status) ?? TABS[0];
  const query = q.trim().slice(0, 60);
  await completeFinishedStays(prisma);

  const search: Prisma.BookingWhereInput = query
    ? {
        OR: [
          { reference: { contains: query.toUpperCase() } },
          { contactName: { contains: query, mode: "insensitive" } },
          { contactEmail: { contains: query, mode: "insensitive" } },
          { property: { title: { contains: query, mode: "insensitive" } } },
        ],
      }
    : {};

  const [bookings, counts] = await Promise.all([
    prisma.booking.findMany({ where: { ...tab.where, ...search }, orderBy: { createdAt: "desc" }, include: bookingListInclude, take: 200 }),
    Promise.all(TABS.map((t) => prisma.booking.count({ where: t.where }))),
  ]);

  return (
    <>
      <PageHeader title="Bookings" subtitle="Every reservation on the platform. Open a booking to manage it." />
      <form method="get" className="mb-5 flex max-w-xl gap-2">
        {tab.value && <input type="hidden" name="status" value={tab.value} />}
        <label className="flex-1">
          <span className="sr-only">Search bookings</span>
          <input name="q" defaultValue={query} placeholder="Search by reference, guest or property" className="input" />
        </label>
        <button type="submit" className="btn btn-navy">
          Search
        </button>
      </form>
      <StatusTabs base="/admin/bookings" current={tab.value} tabs={TABS.map((t, i) => ({ value: t.value, label: t.label, count: counts[i] }))} />
      {bookings.length > 0 ? (
        <ReservationTable bookings={bookings} />
      ) : (
        <EmptyState icon={CalendarCheck} title="No bookings found" text="Try a different status or search term." />
      )}
    </>
  );
}
