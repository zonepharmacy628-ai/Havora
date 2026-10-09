import Link from "next/link";
import { Building2, CalendarCheck, Hourglass, Plus, Wallet } from "lucide-react";
import { bookingListInclude, ReservationTable } from "@/components/booking-list";
import { BarChart, EmptyState, SectionHeading, StatCard } from "@/components/ui";
import { completeFinishedStays } from "@/lib/bookings";
import { formatBps, formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { monthlyBookingTotals, revenueSummary } from "@/lib/reports";
import { requireRole } from "@/lib/session";
import { getSettings } from "@/lib/settings";

export default async function OwnerDashboard() {
  const user = await requireRole(["OWNER"], "/owner");
  const mine = { property: { ownerId: user.id } };
  await completeFinishedStays(prisma, mine);

  const [properties, live, bookingCount, needsAction, summary, monthly, recent, settings] = await Promise.all([
    prisma.property.count({ where: { ownerId: user.id } }),
    prisma.property.count({ where: { ownerId: user.id, status: "PUBLISHED" } }),
    prisma.booking.count({ where: mine }),
    prisma.booking.count({ where: { ...mine, status: { in: ["PENDING", "CANCELLATION_REQUESTED"] } } }),
    revenueSummary(mine),
    monthlyBookingTotals(mine, 12),
    prisma.booking.findMany({ where: mine, orderBy: { createdAt: "desc" }, take: 6, include: bookingListInclude }),
    getSettings(),
  ]);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="heading-serif text-3xl">Welcome back, {user.name.split(" ")[0]}!</h1>
          <p className="mt-1.5 text-sm text-muted">Here&apos;s your property performance overview.</p>
        </div>
        <Link href="/owner/properties/new" className="btn btn-gold">
          <Plus className="size-4" aria-hidden="true" /> Add property
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Building2} label="Total Properties" value={properties} hint={`${live} live`} />
        <StatCard icon={CalendarCheck} label="Total Bookings" value={bookingCount} />
        <StatCard icon={Hourglass} label="Needs Your Action" value={needsAction} hint="Requests & cancellations" />
        <StatCard icon={Wallet} label="Estimated Earnings" value={formatMoney(summary.ownerEarningsCents, "USD", { compact: true })} hint={`After ${formatBps(settings.commissionRateBps)} commission`} />
      </div>

      <section className="mt-10">
        <SectionHeading title="Recent Bookings" href="/owner/bookings" />
        {recent.length > 0 ? (
          <ReservationTable bookings={recent} showEarnings />
        ) : (
          <EmptyState
            icon={CalendarCheck}
            title="No bookings yet"
            text={properties === 0 ? "Add your first property to start receiving reservations." : "Reservations for your listings will appear here."}
            action={
              properties === 0 ? (
                <Link href="/owner/properties/new" className="btn btn-gold">
                  Add your first property
                </Link>
              ) : undefined
            }
          />
        )}
      </section>

      <section className="mt-10">
        <SectionHeading title="Earnings Overview" subtitle="Your estimated earnings by check-in month, last 12 months." href="/owner/earnings" linkLabel="View earnings" />
        <div className="card card-pad">
          <BarChart data={monthly.map((m) => ({ label: m.label, value: m.ownerEarningsCents }))} format={(value) => formatMoney(value, "USD", { compact: true })} />
        </div>
      </section>
    </>
  );
}
