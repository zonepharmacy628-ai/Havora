import Image from "next/image";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { ChevronRight } from "lucide-react";
import { formatDateRange } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { BookingBadge, PaymentBadge } from "./ui";

export const bookingListInclude = {
  property: { select: { title: true, city: true, country: true, images: { orderBy: { position: "asc" }, take: 1, select: { url: true } } } },
  customer: { select: { name: true } },
  payments: { select: { status: true }, orderBy: { createdAt: "asc" }, take: 1 },
} satisfies Prisma.BookingInclude;

export type BookingListItem = Prisma.BookingGetPayload<{ include: typeof bookingListInclude }>;

/** Card list for a customer's own trips. */
export function TripList({ bookings }: { bookings: BookingListItem[] }) {
  return (
    <ul className="space-y-3">
      {bookings.map((booking) => (
        <li key={booking.id}>
          <Link href={`/booking/${booking.reference}`} className="group card flex items-center gap-4 p-3 transition hover:shadow-lift sm:p-4">
            <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-cream-200 sm:h-20 sm:w-28">
              {booking.property.images[0] && <Image src={booking.property.images[0].url} alt="" fill sizes="112px" className="object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-serif text-[17px] font-medium text-ink group-hover:text-gold-700">{booking.property.title}</p>
              <p className="truncate text-xs text-muted">
                {booking.property.city}, {booking.property.country}
              </p>
              <p className="mt-1 text-[13px] text-ink">
                {formatDateRange(booking.checkIn, booking.checkOut)} · {booking.adults + booking.children} guest{booking.adults + booking.children === 1 ? "" : "s"}
              </p>
            </div>
            <div className="hidden shrink-0 flex-col items-end gap-1.5 sm:flex">
              <BookingBadge status={booking.status} />
              <p className="text-sm font-semibold text-ink">{formatMoney(booking.totalCents, booking.currency)}</p>
            </div>
            <ChevronRight className="size-5 shrink-0 text-navy-300 transition group-hover:translate-x-0.5 group-hover:text-gold-600" aria-hidden="true" />
          </Link>
          <div className="mt-1.5 flex items-center justify-between px-1 sm:hidden">
            <BookingBadge status={booking.status} />
            <p className="text-sm font-semibold text-ink">{formatMoney(booking.totalCents, booking.currency)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Table of reservations for hosts and administrators. */
export function ReservationTable({ bookings, showEarnings = false }: { bookings: BookingListItem[]; showEarnings?: boolean }) {
  return (
    <div className="card table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Reference</th>
            <th>Property</th>
            <th>Guest</th>
            <th>Dates</th>
            <th>Status</th>
            <th>Payment</th>
            <th className="text-right">{showEarnings ? "Earnings" : "Total"}</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking) => (
            <tr key={booking.id} className="transition hover:bg-cream-50">
              <td>
                <Link href={`/booking/${booking.reference}`} className="font-semibold tracking-wide text-gold-700 hover:underline">
                  {booking.reference}
                </Link>
              </td>
              <td className="max-w-52 truncate font-medium text-ink">{booking.property.title}</td>
              <td className="text-muted">{booking.customer.name}</td>
              <td className="whitespace-nowrap text-muted">{formatDateRange(booking.checkIn, booking.checkOut)}</td>
              <td>
                <BookingBadge status={booking.status} />
              </td>
              <td>{booking.payments[0] && <PaymentBadge status={booking.payments[0].status} />}</td>
              <td className="text-right font-semibold whitespace-nowrap text-ink">
                {formatMoney(showEarnings ? booking.ownerEarningsCents : booking.totalCents, booking.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StatusTabs({ base, current, tabs }: { base: string; current: string; tabs: { value: string; label: string; count?: number }[] }) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto border-b border-cream-200" role="tablist">
      {tabs.map((tab) => {
        const active = tab.value === current;
        return (
          <Link
            key={tab.value}
            href={tab.value ? `${base}?status=${tab.value}` : base}
            role="tab"
            aria-selected={active}
            className={`-mb-px shrink-0 border-b-2 px-3.5 py-2.5 text-[13px] font-semibold whitespace-nowrap transition ${
              active ? "border-gold-500 text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {tab.label}
            {typeof tab.count === "number" && <span className="ml-1.5 text-xs font-normal text-muted">{tab.count}</span>}
          </Link>
        );
      })}
    </div>
  );
}
