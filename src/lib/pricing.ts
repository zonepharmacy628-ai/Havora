import { applyBps } from "./money";

export type QuoteInput = {
  nightlyPriceCents: number;
  cleaningFeeCents: number;
  nights: number;
  /** Guest service fee charged on the accommodation subtotal, in basis points. */
  serviceFeeBps: number;
  /** Platform commission deducted from the owner's accommodation subtotal, in basis points. */
  commissionBps: number;
};

export type Quote = {
  nights: number;
  nightlyPriceCents: number;
  subtotalCents: number;
  cleaningFeeCents: number;
  serviceFeeCents: number;
  totalCents: number;
  commissionRateBps: number;
  commissionCents: number;
  ownerEarningsCents: number;
};

/**
 * Single source of truth for booking prices. The server always recomputes this
 * from database values; the browser only uses it to preview the same numbers.
 */
export function calculateQuote(input: QuoteInput): Quote {
  const { nightlyPriceCents, cleaningFeeCents, nights, serviceFeeBps, commissionBps } = input;
  for (const [name, value] of Object.entries(input)) {
    if (!Number.isInteger(value) || value < 0) throw new Error(`Invalid ${name}: ${value}`);
  }
  if (nights < 1) throw new Error("A stay must be at least one night");

  const subtotalCents = nightlyPriceCents * nights;
  const serviceFeeCents = applyBps(subtotalCents, serviceFeeBps);
  const commissionCents = applyBps(subtotalCents, commissionBps);

  return {
    nights,
    nightlyPriceCents,
    subtotalCents,
    cleaningFeeCents,
    serviceFeeCents,
    totalCents: subtotalCents + cleaningFeeCents + serviceFeeCents,
    commissionRateBps: commissionBps,
    commissionCents,
    ownerEarningsCents: subtotalCents + cleaningFeeCents - commissionCents,
  };
}
