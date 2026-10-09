// Stay dates are plain calendar dates ("YYYY-MM-DD"). They are stored in
// PostgreSQL DATE columns and represented in JS as UTC-midnight Date objects, so
// no timezone arithmetic can shift a check-in to the wrong day.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function parseDate(value: string): Date {
  if (!isIsoDate(value)) throw new Error(`Invalid date: ${value}`);
  return new Date(`${value}T00:00:00Z`);
}

export function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return toIso(new Date(parseDate(iso).getTime() + days * DAY_MS));
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.round((parseDate(checkOut).getTime() - parseDate(checkIn).getTime()) / DAY_MS);
}

/** Today's calendar date in the given IANA timezone. */
export function todayIn(timezone: string, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return toIso(now);
  }
}

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/** Half-open ranges [aStart, aEnd) and [bStart, bEnd) overlap. */
export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** "Apr 25, 2026" — unambiguous for an international audience. */
export function formatDate(value: string | Date, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const date = typeof value === "string" ? parseDate(value) : value;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: opts.year === false ? undefined : "numeric",
    weekday: opts.weekday ? "short" : undefined,
  }).format(date);
}

export function formatDateRange(checkIn: string | Date, checkOut: string | Date): string {
  return `${formatDate(checkIn, { year: false })} – ${formatDate(checkOut)}`;
}

/** Timestamp formatting for audit logs, messages etc. (shown in UTC). */
export function formatDateTime(value: Date): string {
  return (
    new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(value) + " UTC"
  );
}

export function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

export function monthLabel(key: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short" }).format(new Date(`${key}-01T00:00:00Z`));
}

/** The last `count` month keys ("YYYY-MM"), oldest first, ending with the current month. */
export function lastMonths(count: number, now: Date = new Date()): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    keys.push(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));
  }
  return keys;
}

export function daysAgo(days: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - days * DAY_MS);
}
