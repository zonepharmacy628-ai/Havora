import Link from "next/link";
import type { ReactNode } from "react";
import type { BookingStatus, ListingStatus, PaymentStatus, UserStatus } from "@prisma/client";
import {
  Bath,
  BellRing,
  Car,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Dumbbell,
  Flame,
  Laptop,
  PawPrint,
  Shirt,
  Snowflake,
  Sparkles,
  Star,
  Sunset,
  Umbrella,
  Utensils,
  Waves,
  Wifi,
  Check,
  type LucideIcon,
} from "lucide-react";
import { BOOKING_STATUS_LABEL, LISTING_STATUS_LABEL } from "@/lib/constants";

// ───────────── Ratings ─────────────

export function Rating({ value, count, className = "" }: { value: number; count: number; className?: string }) {
  if (count === 0) return <span className={`text-xs text-muted ${className}`}>New — no reviews yet</span>;
  return (
    <span className={`inline-flex items-center gap-1 text-[13px] ${className}`}>
      <Star className="size-3.5 fill-gold-500 text-gold-500" aria-hidden="true" />
      <span className="font-semibold text-ink">{value.toFixed(1)}</span>
      <span className="text-muted">
        ({count} review{count === 1 ? "" : "s"})
      </span>
    </span>
  );
}

export function Stars({ rating, className = "size-4" }: { rating: number; className?: string }) {
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`${className} ${n <= Math.round(rating) ? "fill-gold-500 text-gold-500" : "fill-cream-200 text-cream-200"}`} aria-hidden="true" />
      ))}
    </span>
  );
}

// ───────────── Amenities ─────────────

const AMENITY_ICONS: Record<string, LucideIcon> = {
  wifi: Wifi,
  waves: Waves,
  car: Car,
  utensils: Utensils,
  snowflake: Snowflake,
  dumbbell: Dumbbell,
  paw: PawPrint,
  sunset: Sunset,
  bath: Bath,
  flame: Flame,
  coffee: Coffee,
  laptop: Laptop,
  shirt: Shirt,
  umbrella: Umbrella,
  bell: BellRing,
  sparkles: Sparkles,
};

export function AmenityIcon({ icon, className = "size-5" }: { icon: string; className?: string }) {
  const Icon = AMENITY_ICONS[icon] ?? Check;
  return <Icon className={className} aria-hidden="true" />;
}

// ───────────── Status badges ─────────────

const BOOKING_TONE: Record<BookingStatus, string> = {
  PENDING: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  CONFIRMED: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
  DECLINED: "bg-red-50 text-red-700 ring-1 ring-red-200",
  CANCELLATION_REQUESTED: "bg-orange-50 text-orange-800 ring-1 ring-orange-200",
  CANCELLED: "bg-cream-100 text-muted ring-1 ring-cream-300",
  COMPLETED: "bg-navy-800 text-gold-300",
  NO_SHOW: "bg-red-50 text-red-700 ring-1 ring-red-200",
};

export function BookingBadge({ status }: { status: BookingStatus }) {
  return <span className={`badge ${BOOKING_TONE[status]}`}>{BOOKING_STATUS_LABEL[status]}</span>;
}

const LISTING_TONE: Record<ListingStatus, string> = {
  DRAFT: "bg-cream-100 text-muted ring-1 ring-cream-300",
  PENDING_REVIEW: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  PUBLISHED: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
  REJECTED: "bg-red-50 text-red-700 ring-1 ring-red-200",
  UNLISTED: "bg-cream-100 text-muted ring-1 ring-cream-300",
};

export function ListingBadge({ status }: { status: ListingStatus }) {
  return <span className={`badge ${LISTING_TONE[status]}`}>{LISTING_STATUS_LABEL[status]}</span>;
}

const PAYMENT_TONE: Record<PaymentStatus, string> = {
  UNPAID: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  PAID: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
  REFUNDED: "bg-cream-100 text-muted ring-1 ring-cream-300",
  VOID: "bg-cream-100 text-muted ring-1 ring-cream-300",
};

const PAYMENT_SHORT: Record<PaymentStatus, string> = { UNPAID: "Unpaid", PAID: "Paid", REFUNDED: "Refunded", VOID: "Void" };

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return <span className={`badge ${PAYMENT_TONE[status]}`}>{PAYMENT_SHORT[status]}</span>;
}

export function UserStatusBadge({ status }: { status: UserStatus }) {
  return (
    <span className={`badge ${status === "ACTIVE" ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200" : "bg-red-50 text-red-700 ring-1 ring-red-200"}`}>
      {status === "ACTIVE" ? "Active" : "Suspended"}
    </span>
  );
}

// ───────────── Layout helpers ─────────────

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="heading-serif text-[28px] leading-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  href,
  linkLabel,
  tone = "dark",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
  tone?: "dark" | "light";
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h2 className={`font-serif text-[26px] leading-tight font-medium tracking-tight sm:text-[32px] ${tone === "light" ? "text-white" : "text-ink"}`}>{title}</h2>
        {subtitle && <p className={`mt-1.5 text-sm ${tone === "light" ? "text-navy-200" : "text-muted"}`}>{subtitle}</p>}
      </div>
      {href && (
        <Link href={href} className="group inline-flex items-center gap-1 text-sm font-semibold text-gold-600 hover:text-gold-700">
          {linkLabel ?? "View all"}
          <ChevronRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-gold-50 text-gold-600 ring-1 ring-gold-100">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <h3 className="heading-serif text-xl">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-muted">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, icon: Icon }: { label: string; value: string | number; hint?: string; icon: LucideIcon }) {
  return (
    <div className="card card-pad flex items-start gap-4">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gold-50 text-gold-600 ring-1 ring-gold-100">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted">{label}</p>
        <p className="mt-0.5 font-serif text-[26px] leading-tight font-medium text-ink">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
    </div>
  );
}

/** Simple, dependency-free bar chart for monthly figures. */
export function BarChart({ data, format }: { data: { label: string; value: number }[]; format: (value: number) => string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const empty = data.every((d) => d.value === 0);
  if (empty) return <p className="py-10 text-center text-sm text-muted">No data for this period yet.</p>;
  return (
    <div className="flex h-52 items-end gap-2 sm:gap-3" role="img" aria-label={data.map((d) => `${d.label}: ${format(d.value)}`).join(", ")}>
      {data.map((d, i) => (
        <div key={`${d.label}-${i}`} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
          <span className="rounded bg-navy-800 px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap text-gold-300 opacity-0 transition group-hover:opacity-100">
            {format(d.value)}
          </span>
          <div
            className={`w-full max-w-10 rounded-t-md transition ${i === data.length - 1 ? "bg-gold-500" : "bg-navy-700 group-hover:bg-gold-400"}`}
            style={{ height: `${Math.max((d.value / max) * 100, d.value > 0 ? 3 : 0.5)}%` }}
          />
          <span className="text-[11px] text-muted">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Pagination({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: (page: number) => string }) {
  if (pages <= 1) return null;
  const numbers = Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1);
  return (
    <nav className="mt-10 flex items-center justify-center gap-1.5" aria-label="Pagination">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className="btn btn-outline btn-sm" aria-label="Previous page">
          <ChevronLeft className="size-4" />
        </Link>
      ) : null}
      {numbers.map((n, i) => (
        <span key={n} className="flex items-center gap-1.5">
          {i > 0 && n - numbers[i - 1] > 1 && <span className="px-1 text-muted">…</span>}
          <Link
            href={hrefFor(n)}
            aria-current={n === page ? "page" : undefined}
            className={`flex size-9 items-center justify-center rounded-md text-sm font-semibold transition ${
              n === page ? "bg-navy-800 text-gold-300" : "border border-cream-300 bg-white text-ink hover:border-gold-500"
            }`}
          >
            {n}
          </Link>
        </span>
      ))}
      {page < pages ? (
        <Link href={hrefFor(page + 1)} className="btn btn-outline btn-sm" aria-label="Next page">
          <ChevronRight className="size-4" />
        </Link>
      ) : null}
    </nav>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "success" | "warning"; children: ReactNode }) {
  const tones = {
    info: "border-gold-100 bg-gold-50 text-gold-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
  };
  return <div className={`rounded-lg border px-4 py-3 text-sm ${tones[tone]}`}>{children}</div>;
}

export function Avatar({ name, className = "size-10 text-sm" }: { name: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-navy-700 font-semibold text-gold-300 ring-1 ring-gold-500/40 ${className}`} aria-hidden="true">
      {initials}
    </span>
  );
}
