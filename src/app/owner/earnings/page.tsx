import { BadgeDollarSign, HandCoins, Percent, Wallet } from "lucide-react";
import { BarChart, Notice, PageHeader, StatCard } from "@/components/ui";
import { HOST_ROLES, REVENUE_BOOKING_STATUSES } from "@/lib/booking-rules";
import { formatBps, formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { monthlyBookingTotals, revenueSummary } from "@/lib/reports";
import { requireRole } from "@/lib/session";
import { getSettings } from "@/lib/settings";

export default async function OwnerEarningsPage() {
  const user = await requireRole(HOST_ROLES, "/owner/earnings");
  const mine = { property: { ownerId: user.id } };

  const [summary, monthly, collected, perProperty, settings] = await Promise.all([
    revenueSummary(mine),
    monthlyBookingTotals(mine, 12),
    prisma.payment.aggregate({ where: { status: "PAID", booking: mine }, _sum: { amountCents: true } }),
    prisma.booking.groupBy({
      by: ["propertyId"],
      where: { ...mine, status: { in: REVENUE_BOOKING_STATUSES } },
      _sum: { subtotalCents: true, cleaningFeeCents: true, commissionCents: true, ownerEarningsCents: true, nights: true },
      _count: { _all: true },
    }),
    getSettings(),
  ]);
  const titles = new Map((await prisma.property.findMany({ where: { ownerId: user.id }, select: { id: true, title: true } })).map((p) => [p.id, p.title]));
  const money = (cents: number) => formatMoney(cents, "USD");
  const collectedCents = collected._sum.amountCents ?? 0;

  return (
    <>
      <PageHeader title="Earnings" subtitle="Estimated from confirmed and completed bookings. Cancelled and declined bookings are excluded." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={BadgeDollarSign} label="Guest Payments (gross)" value={money(summary.totalCents)} hint={`${summary.bookings} booking${summary.bookings === 1 ? "" : "s"}`} />
        <StatCard icon={Percent} label="Platform Fees" value={money(summary.commissionCents + summary.serviceFeeCents)} hint="Commission + guest service fee" />
        <StatCard icon={Wallet} label="Your Estimated Earnings" value={money(summary.ownerEarningsCents)} />
        <StatCard icon={HandCoins} label="Collected at Property" value={money(collectedCents)} hint={`${money(Math.max(summary.totalCents - collectedCents, 0))} not yet recorded`} />
      </div>

      <div className="mt-6">
        <Notice>
          <strong>How Pay at Property works.</strong> Guests pay you the full booking total on arrival. HAVORA&apos;s commission (currently {formatBps(settings.commissionRateBps)} of the accommodation subtotal for new bookings) and the guest service fee are owed to the platform and settled separately. Automated payouts and invoices are not part of this release.
        </Notice>
      </div>

      <section className="card card-pad mt-8">
        <h2 className="mb-5 font-serif text-lg font-medium text-ink">Earnings by check-in month</h2>
        <BarChart data={monthly.map((m) => ({ label: m.label, value: m.ownerEarningsCents }))} format={(value) => formatMoney(value, "USD", { compact: true })} />
      </section>

      <section className="mt-8">
        <h2 className="mb-4 font-serif text-lg font-medium text-ink">By property</h2>
        {perProperty.length === 0 ? (
          <p className="card card-pad text-sm text-muted">No earnings yet.</p>
        ) : (
          <div className="card table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Property</th>
                  <th className="text-right">Bookings</th>
                  <th className="text-right">Nights</th>
                  <th className="text-right">Accommodation</th>
                  <th className="text-right">Cleaning</th>
                  <th className="text-right">Commission</th>
                  <th className="text-right">Your earnings</th>
                </tr>
              </thead>
              <tbody>
                {perProperty.map((row) => (
                  <tr key={row.propertyId}>
                    <td className="font-medium text-ink">{titles.get(row.propertyId) ?? "—"}</td>
                    <td className="text-right text-muted">{row._count._all}</td>
                    <td className="text-right text-muted">{row._sum.nights ?? 0}</td>
                    <td className="text-right text-muted">{money(row._sum.subtotalCents ?? 0)}</td>
                    <td className="text-right text-muted">{money(row._sum.cleaningFeeCents ?? 0)}</td>
                    <td className="text-right text-muted">− {money(row._sum.commissionCents ?? 0)}</td>
                    <td className="text-right font-semibold text-ink">{money(row._sum.ownerEarningsCents ?? 0)}</td>
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
