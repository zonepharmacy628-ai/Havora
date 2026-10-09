import Link from "next/link";
import { Building2, CalendarCheck, CircleDollarSign, Users } from "lucide-react";
import { bookingListInclude, ReservationTable } from "@/components/booking-list";
import { BarChart, ListingBadge, SectionHeading, StatCard } from "@/components/ui";
import { completeFinishedStays } from "@/lib/bookings";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { monthlyBookingTotals, revenueSummary } from "@/lib/reports";
import { requireRole } from "@/lib/session";

export default async function AdminDashboard() {
  await requireRole(["ADMIN"], "/admin");
  await completeFinishedStays(prisma);

  const [users, owners, customers, properties, liveProperties, bookings, summary, monthly, pending, recent] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "OWNER" } }),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.property.count(),
    prisma.property.count({ where: { status: "PUBLISHED" } }),
    prisma.booking.count(),
    revenueSummary({}),
    monthlyBookingTotals({}, 12),
    prisma.property.findMany({
      where: { status: "PENDING_REVIEW" },
      orderBy: { updatedAt: "asc" },
      take: 6,
      select: { id: true, title: true, city: true, country: true, status: true, updatedAt: true, owner: { select: { name: true } } },
    }),
    prisma.booking.findMany({ orderBy: { createdAt: "desc" }, take: 6, include: bookingListInclude }),
  ]);

  return (
    <>
      <h1 className="heading-serif text-3xl">Platform Overview</h1>
      <p className="mt-1.5 mb-6 text-sm text-muted">Live figures from the HAVORA database.</p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="Total Users" value={users} hint={`${customers} customers · ${owners} owners`} />
        <StatCard icon={Building2} label="Properties" value={properties} hint={`${liveProperties} published`} />
        <StatCard icon={CalendarCheck} label="Total Bookings" value={bookings} hint={`${summary.bookings} confirmed or completed`} />
        <StatCard icon={CircleDollarSign} label="Booking Value" value={formatMoney(summary.totalCents, "USD", { compact: true })} hint={`${formatMoney(summary.commissionCents + summary.serviceFeeCents, "USD", { compact: true })} platform fees`} />
      </div>

      <section className="mt-10">
        <SectionHeading title="Recent Listings for Review" href="/admin/properties?status=PENDING_REVIEW" linkLabel="Review queue" />
        {pending.length === 0 ? (
          <p className="card card-pad text-sm text-muted">The review queue is empty.</p>
        ) : (
          <div className="card table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Owner</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pending.map((property) => (
                  <tr key={property.id}>
                    <td>
                      <p className="font-medium text-ink">{property.title}</p>
                      <p className="text-xs text-muted">{property.city}, {property.country}</p>
                    </td>
                    <td className="text-muted">{property.owner.name}</td>
                    <td className="text-muted">{formatDate(property.updatedAt)}</td>
                    <td><ListingBadge status={property.status} /></td>
                    <td className="text-right">
                      <Link href="/admin/properties?status=PENDING_REVIEW" className="btn btn-navy btn-sm">Review</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10">
        <SectionHeading title="Revenue Overview" subtitle="Total booking value by check-in month, last 12 months." href="/admin/reports" linkLabel="Open reports" />
        <div className="card card-pad">
          <BarChart data={monthly.map((m) => ({ label: m.label, value: m.totalCents }))} format={(value) => formatMoney(value, "USD", { compact: true })} />
        </div>
      </section>

      <section className="mt-10">
        <SectionHeading title="Latest Bookings" href="/admin/bookings" />
        {recent.length > 0 ? <ReservationTable bookings={recent} /> : <p className="card card-pad text-sm text-muted">No bookings yet.</p>}
      </section>
    </>
  );
}
