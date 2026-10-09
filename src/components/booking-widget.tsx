"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus, ShieldCheck } from "lucide-react";
import { addDays, formatDate, nightsBetween, toIso } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { calculateQuote } from "@/lib/pricing";

export type UnavailableRange = { start: string; end: string };

export type BookingConfig = {
  slug: string;
  currency: string;
  nightlyPriceCents: number;
  cleaningFeeCents: number;
  serviceFeeBps: number;
  maxGuests: number;
  minNights: number;
  maxNights: number;
  /** Today's date in the property's timezone. */
  today: string;
  unavailable: UnavailableRange[];
  instantBook: boolean;
  bookable: boolean;
};

type Stay = { checkIn: string | null; checkOut: string | null; adults: number; children: number };

type Ctx = {
  config: BookingConfig;
  stay: Stay;
  setStay: (stay: Stay) => void;
  isNightTaken: (date: string) => boolean;
  /** Reason the current selection cannot be booked, if any. */
  problem: string | null;
};

const BookingContext = createContext<Ctx | null>(null);

function useBooking(): Ctx {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error("Booking components must be rendered inside <BookingProvider>");
  return ctx;
}

function buildTakenSet(ranges: UnavailableRange[], from: string): Set<string> {
  const taken = new Set<string>();
  const horizon = addDays(from, 560);
  for (const range of ranges) {
    for (let day = range.start < from ? from : range.start; day < range.end && day < horizon; day = addDays(day, 1)) taken.add(day);
  }
  return taken;
}

export function BookingProvider({ config, initial, children }: { config: BookingConfig; initial: Stay; children: ReactNode }) {
  const [stay, setStay] = useState<Stay>(initial);
  const taken = useMemo(() => buildTakenSet(config.unavailable, config.today), [config.unavailable, config.today]);

  const value = useMemo<Ctx>(() => {
    const isNightTaken = (date: string) => date < config.today || taken.has(date);
    let problem: string | null = null;
    if (stay.checkIn && stay.checkOut) {
      const nights = nightsBetween(stay.checkIn, stay.checkOut);
      for (let day = stay.checkIn; day < stay.checkOut; day = addDays(day, 1)) {
        if (isNightTaken(day)) {
          problem = "Some of those nights are not available.";
          break;
        }
      }
      if (!problem && nights < config.minNights) problem = `Minimum stay is ${config.minNights} night${config.minNights === 1 ? "" : "s"}.`;
      if (!problem && nights > config.maxNights) problem = `Maximum stay is ${config.maxNights} nights.`;
    }
    return { config, stay, setStay, isNightTaken, problem };
  }, [config, stay, taken]);

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}

// ───────────────────────── Availability calendar ─────────────────────────

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month, 1));
  const lead = (first.getUTCDay() + 6) % 7; // Monday-first
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= days; day++) cells.push(toIso(new Date(Date.UTC(year, month, day))));
  return cells;
}

export function AvailabilityCalendar() {
  const { config, stay, setStay, isNightTaken } = useBooking();
  const base = stay.checkIn ?? config.today;
  const [cursor, setCursor] = useState(() => ({ year: Number(base.slice(0, 4)), month: Number(base.slice(5, 7)) - 1 }));

  const todayMonth = Number(config.today.slice(0, 4)) * 12 + Number(config.today.slice(5, 7)) - 1;
  const cursorMonth = cursor.year * 12 + cursor.month;
  const canGoBack = cursorMonth > todayMonth;
  const canGoForward = cursorMonth < todayMonth + 17;
  const shift = (delta: number) => {
    const next = new Date(Date.UTC(cursor.year, cursor.month + delta, 1));
    setCursor({ year: next.getUTCFullYear(), month: next.getUTCMonth() });
  };

  function select(date: string) {
    const { checkIn, checkOut } = stay;
    // Completing a range: every night between check-in and the clicked day must be free.
    if (checkIn && !checkOut && date > checkIn) {
      for (let day = checkIn; day < date; day = addDays(day, 1)) {
        if (isNightTaken(day)) {
          if (!isNightTaken(date)) setStay({ ...stay, checkIn: date, checkOut: null });
          return;
        }
      }
      setStay({ ...stay, checkOut: date });
      return;
    }
    if (isNightTaken(date)) return;
    setStay({ ...stay, checkIn: date, checkOut: null });
  }

  const months = [0, 1].map((offset) => {
    const d = new Date(Date.UTC(cursor.year, cursor.month + offset, 1));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button type="button" onClick={() => shift(-1)} disabled={!canGoBack} aria-label="Previous month" className="btn btn-outline btn-sm size-9 p-0 disabled:opacity-30">
          <ChevronLeft className="size-4" />
        </button>
        <p className="text-xs text-muted" aria-live="polite">
          {stay.checkIn && !stay.checkOut ? "Now choose your check-out date" : "Select check-in, then check-out"}
        </p>
        <button type="button" onClick={() => shift(1)} disabled={!canGoForward} aria-label="Next month" className="btn btn-outline btn-sm size-9 p-0 disabled:opacity-30">
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="grid gap-8 sm:grid-cols-2">
        {months.map(({ year, month }, index) => (
          <div key={`${year}-${month}`} className={index === 1 ? "hidden sm:block" : ""}>
            <p className="mb-3 text-center text-sm font-semibold text-ink">
              {new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month, 1)))}
            </p>
            <div className="grid grid-cols-7 gap-y-1 text-center">
              {WEEKDAYS.map((day) => (
                <span key={day} className="pb-1 text-[11px] font-medium text-muted">
                  {day}
                </span>
              ))}
              {monthGrid(year, month).map((date, i) => {
                if (!date) return <span key={`blank-${i}`} />;
                const taken = isNightTaken(date);
                const isStart = date === stay.checkIn;
                const isEnd = date === stay.checkOut;
                const inRange = Boolean(stay.checkIn && stay.checkOut && date > stay.checkIn && date < stay.checkOut);
                // A taken day can still be picked as a check-out (the guest leaves that morning).
                const selectableAsCheckout = Boolean(stay.checkIn && !stay.checkOut && date > stay.checkIn && !isNightTaken(addDays(date, -1)));
                const disabled = date < config.today || (taken && !selectableAsCheckout);
                return (
                  <button
                    key={date}
                    type="button"
                    disabled={disabled}
                    onClick={() => select(date)}
                    aria-label={`${formatDate(date, { weekday: true })}${taken ? ", unavailable" : ""}`}
                    aria-pressed={isStart || isEnd}
                    className={`mx-auto flex size-9 items-center justify-center text-[13px] transition ${
                      isStart || isEnd
                        ? "rounded-full bg-gold-500 font-semibold text-navy-950"
                        : inRange
                          ? "w-full rounded-none bg-gold-100 text-ink"
                          : disabled
                            ? "cursor-not-allowed rounded-full text-navy-200 line-through decoration-navy-200/70"
                            : "cursor-pointer rounded-full text-ink hover:bg-navy-800 hover:text-white"
                    } ${date === config.today && !isStart && !isEnd ? "ring-1 ring-gold-500" : ""}`}
                  >
                    {Number(date.slice(8))}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-gold-500" /> Selected
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-full border border-cream-300 bg-white" /> Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-navy-200 line-through">12</span> Unavailable
        </span>
        {(stay.checkIn || stay.checkOut) && (
          <button type="button" onClick={() => setStay({ ...stay, checkIn: null, checkOut: null })} className="ml-auto cursor-pointer font-semibold text-gold-700 hover:underline">
            Clear dates
          </button>
        )}
      </div>
    </div>
  );
}

// ───────────────────────────── Booking panel ─────────────────────────────

function Stepper({ label, hint, value, min, max, onChange }: { label: string; hint: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="text-xs text-muted">{hint}</p>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={`Fewer ${label.toLowerCase()}`} className="flex size-8 cursor-pointer items-center justify-center rounded-full border border-cream-300 text-ink transition hover:border-gold-500 disabled:cursor-not-allowed disabled:opacity-30">
          <Minus className="size-3.5" />
        </button>
        <span className="w-5 text-center text-sm font-semibold" aria-live="polite">
          {value}
        </span>
        <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`More ${label.toLowerCase()}`} className="flex size-8 cursor-pointer items-center justify-center rounded-full border border-cream-300 text-ink transition hover:border-gold-500 disabled:cursor-not-allowed disabled:opacity-30">
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

export function BookingPanel({ children }: { children?: ReactNode }) {
  const router = useRouter();
  const { config, stay, setStay, problem } = useBooking();
  const { checkIn, checkOut, adults, children: kids } = stay;
  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0;
  const ready = Boolean(checkIn && checkOut && !problem && config.bookable);

  // Preview only — the server recalculates the price from the database at checkout.
  const quote =
    nights > 0
      ? calculateQuote({ nightlyPriceCents: config.nightlyPriceCents, cleaningFeeCents: config.cleaningFeeCents, nights, serviceFeeBps: config.serviceFeeBps, commissionBps: 0 })
      : null;
  const money = (cents: number) => formatMoney(cents, config.currency);

  function reserve() {
    if (!ready || !checkIn || !checkOut) return;
    const params = new URLSearchParams({ property: config.slug, checkIn, checkOut, adults: String(adults), children: String(kids) });
    router.push(`/checkout?${params.toString()}`);
  }

  return (
    <div className="card card-pad">
      <p className="text-sm text-muted">
        <span className="font-serif text-[28px] font-semibold text-ink">{money(config.nightlyPriceCents)}</span> / night
      </p>

      <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-xl border border-cream-300">
        <a href="#availability" className="border-r border-cream-300 px-3.5 py-2.5 transition hover:bg-cream-50">
          <span className="block text-[11px] font-semibold tracking-wide text-muted uppercase">Check-in</span>
          <span className={`block text-sm ${checkIn ? "font-semibold text-ink" : "text-navy-300"}`}>{checkIn ? formatDate(checkIn) : "Add date"}</span>
        </a>
        <a href="#availability" className="px-3.5 py-2.5 transition hover:bg-cream-50">
          <span className="block text-[11px] font-semibold tracking-wide text-muted uppercase">Check-out</span>
          <span className={`block text-sm ${checkOut ? "font-semibold text-ink" : "text-navy-300"}`}>{checkOut ? formatDate(checkOut) : "Add date"}</span>
        </a>
      </div>

      <div className="mt-3 rounded-xl border border-cream-300 px-3.5 py-1">
        <Stepper label="Adults" hint="Ages 13+" value={adults} min={1} max={config.maxGuests - kids} onChange={(value) => setStay({ ...stay, adults: value })} />
        <div className="divider" />
        <Stepper label="Children" hint="Ages 2–12" value={kids} min={0} max={config.maxGuests - adults} onChange={(value) => setStay({ ...stay, children: value })} />
      </div>
      <p className="mt-1.5 text-xs text-muted">Sleeps up to {config.maxGuests} guests.</p>

      {problem && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {problem}
        </p>
      )}

      <button type="button" onClick={reserve} disabled={!ready} className="btn btn-gold btn-lg mt-4 w-full">
        {!config.bookable ? "Not available" : checkIn && checkOut ? (config.instantBook ? "Book Now" : "Request to Book") : "Select dates"}
      </button>
      <p className="mt-2 text-center text-xs text-muted">You won&apos;t be charged online — pay at the property.</p>

      {quote && (
        <dl className="mt-5 space-y-2.5 border-t border-cream-200 pt-5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">
              {money(config.nightlyPriceCents)} × {nights} night{nights === 1 ? "" : "s"}
            </dt>
            <dd className="text-ink">{money(quote.subtotalCents)}</dd>
          </div>
          {quote.cleaningFeeCents > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted">Cleaning fee</dt>
              <dd className="text-ink">{money(quote.cleaningFeeCents)}</dd>
            </div>
          )}
          {quote.serviceFeeCents > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted">Service fee</dt>
              <dd className="text-ink">{money(quote.serviceFeeCents)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-cream-200 pt-3 text-base font-semibold text-ink">
            <dt>Total</dt>
            <dd>{money(quote.totalCents)}</dd>
          </div>
        </dl>
      )}

      {children && <div className="mt-4">{children}</div>}

      <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-gold-600" aria-hidden="true" />
        Final price and availability are confirmed on the next step before you reserve.
      </p>
    </div>
  );
}
