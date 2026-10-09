import { BadgeDollarSign, CalendarCheck, Percent, TrendingUp } from "lucide-react";
import { BarChart, PageHeader, StatCard } from "@/components/ui";
import { REVENUE_BOOKING_STATUSES } from "@/lib/booking-rules";
import { BOOKING_STATUS_LABEL } from "@/lib/constants";
import { daysAgo } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { monthlyBookingTotals, revenueSummary } from "@/lib/reports";
import { requireRole } from "@/lib/session";

export default async function AdminReportsPage() {
  await requireRole(["ADMIN"], "/admin/reports");

  const [summary, monthly, byStatus, byProperty, payments, signups] = await Promise.all([
    revenueSummary({}),
    monthlyBookingTotals({}, 12),
    prisma.booking.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.booking.groupBy({
      by: ["propertyId"],
      where: { status: { in: REVENUE_BOOKING_STATUSES } },
      _sum: { totalCents: true, commissionCents: true, serviceFeeCents: true, nights: true },
      _count: { _all: true },
      orderBy: { _sum: { totalCents: "desc" } },
      take: 10,
    }),
    prisma.payment.groupBy({ by: ["status"], _sum: { amountCents: true }, _count: { _all: true } }),
    prisma.user.count({ where: { createdAt: { gte: daysAgo(30) } } }),
  ]);
  const properties = new Map(
    (await prisma.property.findMany({ where: { id: { in: byProperty.map((row) => row.propertyId) } }, select: { id: true, title: true, city: true } })).map((p) => [p.id, p]),
  );
  const money = (cents: number) => formatMoney(cents, "USD");
  const platformFees = summary.commissionCents + summary.serviceFeeCents;
  const average = summary.bookings ? Math.round(summary.totalCents / summary.bookings) : 0;

  return (
    <>
      <PageHeader title="Reports" subtitle="Calculated live from booking and payment records. Cancelled, declined and no-show bookings are excluded from revenue." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={BadgeDollarSign} label="Booking Value" value={money(summary.totalCents)} hint={`${summary.bookings} bookings`} />
        <StatCard icon={Percent} label="Platform Fees Earned" value={money(platformFees)} hint={`${money(summary.commissionCents)} commission + ${money(summary.serviceFeeCents)} service`} />
        <StatCard icon={TrendingUp} label="Average Booking" value={money(average)} />
        <StatCard icon={CalendarCheck} label="New Users (30 days)" value={signups} />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="card card-pad">
          <h2 className="mb-5 font-serif text-lg font-medium text-ink">Booking value by check-in month</h2>
          <BarChart data={monthly.map((m) => ({ label: m.label, value: m.totalCents }))} format={(value) => formatMoney(value, "USD", { compact: true })} />
        </section>
        <section className="card card-pad">
          <h2 className="mb-5 font-serif text-lg font-medium text-ink">Platform fees by check-in month</h2>
          <BarChart data={monthly.map((m) => ({ label: m.label, value: m.platformCents }))} format={(value) => formatMoney(value, "USD", { compact: true })} />
        </section>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="card card-pad">
          <h2 className="mb-4 font-serif text-lg font-medium text-ink">Bookings by status</h2>
          <dl className="divide-y divide-cream-200 text-sm">
            {byStatus.length === 0 && <p className="text-muted">No bookings yet.</p>}
            {byStatus.map((row) => (
              <div key={row.status} className="flex justify-between py-2.5">
                <dt className="text-muted">{BOOKING_STATUS_LABEL[row.status]}</dt>
                <dd className="font-semibold text-ink">{row._count._all}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="card card-pad">
          <h2 className="mb-4 font-serif text-lg font-medium text-ink">Payments (Pay at Property)</h2>
          <dl className="divide-y divide-cream-200 text-sm">
            {payments.length === 0 && <p className="text-muted">No payment records yet.</p>}
            {payments.map((row) => (
              <div key={row.status} className="flex justify-between py-2.5">
                <dt className="text-muted">
                  {row.status === "UNPAID" ? "Unpaid — due at property" : row.status === "PAID" ? "Recorded as collected" : row.status === "VOID" ? "Void (booking not fulfilled)" : "Refunded"}
                  <span className="ml-1.5 text-xs">({row._count._all})</span>
                </dt>
                <dd className="font-semibold text-ink">{money(row._sum.amountCents ?? 0)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted">No online payments are processed in this release; “collected” amounts are recorded by hosts.</p>
        </section>
      </div>

      <section className="mt-8">
        <h2 className="mb-4 font-serif text-lg font-medium text-ink">Top properties by booking value</h2>
        {byProperty.length === 0 ? (
          <p className="card card-pad text-sm text-muted">No revenue yet.</p>
        ) : (
          <div className="card table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Property</th>
                  <th className="text-right">Bookings</th>
                  <th className="text-right">Nights</th>
                  <th className="text-right">Platform fees</th>
                  <th className="text-right">Booking value</th>
                </tr>
              </thead>
              <tbody>
                {byProperty.map((row) => (
                  <tr key={row.propertyId}>
                    <td>
                      <p className="font-medium text-ink">{properties.get(row.propertyId)?.title ?? "—"}</p>
                      <p className="text-xs text-muted">{properties.get(row.propertyId)?.city}</p>
                    </td>
                    <td className="text-right text-muted">{row._count._all}</td>
                    <td className="text-right text-muted">{row._sum.nights ?? 0}</td>
                    <td className="text-right text-muted">{money((row._sum.commissionCents ?? 0) + (row._sum.serviceFeeCents ?? 0))}</td>
                    <td className="text-right font-semibold text-ink">{money(row._sum.totalCents ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
