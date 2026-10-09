// All amounts are integer minor units (cents). Never use floats for money maths.

export const DEFAULT_CURRENCY = "USD";

/** Currencies the platform can display. Add entries here to enable more later. */
export const SUPPORTED_CURRENCIES = ["USD"] as const;

export function formatMoney(cents: number, currency: string = DEFAULT_CURRENCY, opts: { compact?: boolean } = {}): string {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: whole || opts.compact ? 0 : 2,
    maximumFractionDigits: opts.compact ? 0 : 2,
  }).format(cents / 100);
}

/** Parses a user-entered decimal amount ("185", "185.50") into cents without float drift. */
export function parseMoneyToCents(input: string): number | null {
  const trimmed = input.trim().replace(/,/g, "");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(trimmed)) return null;
  const [units, fraction = ""] = trimmed.split(".");
  return Number(units) * 100 + Number(fraction.padEnd(2, "0"));
}

export function centsToInput(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

/** Basis points → integer cents, rounded half up. */
export function applyBps(cents: number, bps: number): number {
  return Math.round((cents * bps) / 10_000);
}

export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`;
}
