import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarCheck, CalendarClock, Heart, History } from "lucide-react";
import { bookingListInclude, TripList } from "@/components/booking-list";
import { EmptyState, SectionHeading, StatCard } from "@/components/ui";
import { completeFinishedStays } from "@/lib/bookings";
import { HOST_IMAGE } from "@/lib/constants";
import { formatDateTime } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

const ACTIVITY_LABEL: Record<string, string> = {
  "booking.created": "You made a booking",
  "booking.cancelled": "A booking was cancelled",
  "booking.cancellation_requested": "You requested a cancellation",
  "user.registered": "You joined HAVORA",
  "user.password_changed": "You changed your password",
};

export default async function AccountDashboard() {
  const user = await requireUser("/account");
  await completeFinishedStays(prisma, { customerId: user.id });
  const today = new Date(new Date().toISOString().slice(0, 10));

  const [upcomingCount, pastCount, wishlistCount, upcoming, activity] = await Promise.all([
    prisma.booking.count({ where: { customerId: user.id, status: { in: ["PENDING", "CONFIRMED", "CANCELLATION_REQUESTED"] }, checkOut: { gte: today } } }),
    prisma.booking.count({ where: { customerId: user.id, status: "COMPLETED" } }),
    prisma.wishlist.count({ where: { userId: user.id } }),
    prisma.booking.findMany({
      where: { customerId: user.id, status: { in: ["PENDING", "CONFIRMED", "CANCELLATION_REQUESTED"] }, checkOut: { gte: today } },
      orderBy: { checkIn: "asc" },
      take: 3,
      include: bookingListInclude,
    }),
    prisma.auditLog.findMany({ where: { actorId: user.id, action: { in: Object.keys(ACTIVITY_LABEL) } }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  return (
    <div className="grid gap-8 xl:grid-cols-[1fr_300px]">
      <div>
        <h1 className="heading-serif text-3xl">Welcome back, {user.name.split(" ")[0]}!</h1>
        <p className="mt-1.5 mb-6 text-sm text-muted">Here&apos;s what&apos;s happening with your bookings.</p>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard icon={CalendarClock} label="Upcoming Bookings" value={upcomingCount} />
          <StatCard icon={History} label="Past Stays" value={pastCount} />
          <StatCard icon={Heart} label="Wishlist" value={wishlistCount} />
        </div>

        <div className="mt-10">
          <SectionHeading title="Upcoming Bookings" href="/account/bookings" />
          {upcoming.length > 0 ? (
            <TripList bookings={upcoming} />
          ) : (
            <EmptyState
              icon={CalendarCheck}
              title="No upcoming trips"
              text="When you reserve a stay it will appear here with all the details you need."
              action={
                <Link href="/properties" className="btn btn-gold">
                  Browse properties
                </Link>
              }
            />
          )}
        </div>

        <div className="mt-10">
          <SectionHeading title="Recent Activity" />
          {activity.length > 0 ? (
            <ul className="card divide-y divide-cream-200">
              {activity.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-4 px-5 py-3.5 text-sm">
                  <span className="text-ink">
                    {ACTIVITY_LABEL[entry.action]}
                    {typeof (entry.metadata as { reference?: string } | null)?.reference === "string" && (
                      <span className="ml-1.5 font-semibold text-gold-700">{(entry.metadata as { reference: string }).reference}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-muted">{formatDateTime(entry.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="card card-pad text-sm text-muted">No activity yet.</p>
          )}
        </div>
      </div>

      <aside className="relative isolate hidden min-h-[420px] flex-col justify-start overflow-hidden rounded-2xl bg-navy-900 p-7 xl:flex xl:self-start">
        <Image src={HOST_IMAGE} alt="" fill sizes="300px" className="-z-20 object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-navy-950/95 via-navy-950/60 to-navy-950/10" />
        <h2 className="font-serif text-2xl font-medium text-gold-300">Explore More</h2>
        <p className="mt-2 text-sm leading-6 text-navy-200">Discover new destinations and amazing properties.</p>
        <Link href="/properties" className="btn btn-gold btn-sm mt-5 self-start px-4 py-2">
          Browse Properties <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </aside>
    </div>
  );
}
