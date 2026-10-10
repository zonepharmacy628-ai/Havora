import { CalendarCheck } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { bookingListInclude, ReservationTable, StatusTabs } from "@/components/booking-list";
import { EmptyState, PageHeader } from "@/components/ui";
import { completeFinishedStays } from "@/lib/bookings";
import { prisma } from "@/lib/prisma";
import { HOST_ROLES } from "@/lib/booking-rules";
import { requireRole } from "@/lib/session";

const TABS: { value: string; label: string; where: Prisma.BookingWhereInput }[] = [
  { value: "", label: "All", where: {} },
  { value: "action", label: "Needs action", where: { status: { in: ["PENDING", "CANCELLATION_REQUESTED"] } } },
  { value: "confirmed", label: "Confirmed", where: { status: "CONFIRMED" } },
  { value: "completed", label: "Completed", where: { status: "COMPLETED" } },
  { value: "cancelled", label: "Cancelled", where: { status: { in: ["CANCELLED", "DECLINED", "NO_SHOW"] } } },
];

export default async function OwnerBookingsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await requireRole(HOST_ROLES, "/owner/bookings");
  const { status = "" } = await searchParams;
  const tab = TABS.find((t) => t.value === status) ?? TABS[0];
  // Scoped to this owner's listings — an owner can never list another owner's reservations.
  const mine: Prisma.BookingWhereInput = { property: { ownerId: user.id } };
  await completeFinishedStays(prisma, mine);

  const [bookings, counts] = await Promise.all([
    prisma.booking.findMany({ where: { ...mine, ...tab.where }, orderBy: { checkIn: "desc" }, include: bookingListInclude, take: 200 }),
    Promise.all(TABS.map((t) => prisma.booking.count({ where: { ...mine, ...t.where } }))),
  ]);

  return (
    <>
      <PageHeader title="Reservations" subtitle="Confirm requests, handle cancellations and record payments collected at your property." />
      <StatusTabs base="/owner/bookings" current={tab.value} tabs={TABS.map((t, i) => ({ value: t.value, label: t.label, count: counts[i] }))} />
      {bookings.length > 0 ? (
        <ReservationTable bookings={bookings} showEarnings />
      ) : (
        <EmptyState icon={CalendarCheck} title="Nothing here yet" text="Reservations matching this filter will appear here." />
      )}
    </>
  );
}
