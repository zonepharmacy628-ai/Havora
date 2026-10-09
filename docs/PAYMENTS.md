# Payments in HAVORA

## What exists today

HAVORA launches with **Pay at Property** only. There is **no payment gateway**, no
card form and no simulated online payment anywhere in the codebase.

| Concern | How it works now |
| --- | --- |
| Booking method | `PAY_AT_PROPERTY` is the only accepted value. `createBooking()` rejects `ONLINE`. |
| Checkout UI | "Online payment" is shown disabled with a "Coming soon" label. |
| Payment record | One `Payment` row per booking, created `UNPAID` with the server-calculated total. |
| Becoming paid | Only when the host (or an admin) clicks **Record … collected** on or after check-in. This sets `PAID`, `paidAt` and `recordedById`, and writes an audit log entry. |
| Cancelled / declined / no-show | The unpaid payment becomes `VOID`. Nothing is ever marked refunded automatically. |
| Card data | Never collected, transmitted or stored. |
| Commission | Captured per booking (`commissionRateBps`, `commissionCents`, `ownerEarningsCents`) at booking time. Settling commission with hosts is a manual/off-platform process for now. |

Booking status (`Booking.status`) and payment status (`Payment.status`) are separate
columns in separate tables, so a booking can be `CONFIRMED` while its payment is `UNPAID`.

A database check constraint (`Payment_paid_at_check`) makes it impossible to store a
`PAID` payment without a `paidAt` timestamp.

## Data model reserved for a gateway

```
Payment
  method       PAY_AT_PROPERTY | ONLINE
  status       UNPAID | PAID | REFUNDED | VOID
  amountCents  integer minor units
  currency     ISO 4217
  provider     e.g. "stripe"            (unused today)
  providerRef  provider's payment id     (unused today)
  paidAt, recordedById, note

Payout (unused today)
  ownerId, bookingId, amountCents, currency, status, reference, scheduledFor, paidAt
```

## Adding a real provider later (e.g. Stripe)

1. **Configuration** — add the provider's secret key and webhook secret as environment
   variables (never in the repo). Add them to `.env.example` as empty placeholders.
2. **Enable the method** — in `src/lib/bookings.ts`, allow `ONLINE` when the provider is
   configured, and create the booking as `PENDING` with an `UNPAID` `ONLINE` payment.
   Keep price calculation exactly where it is: on the server, from database values.
3. **Create a checkout session** — add a server action that creates a hosted checkout /
   payment intent for `payment.amountCents`, stores the provider id in
   `Payment.providerRef`, and redirects the guest to the provider. Use the booking
   reference as the idempotency key.
4. **Webhook** — add `src/app/api/webhooks/<provider>/route.ts`. Verify the signature,
   then in one transaction: mark the `Payment` `PAID` (with `paidAt`), confirm the
   booking, and write an audit log entry. **Only the verified webhook may mark an online
   payment as paid** — never the browser redirect.
5. **Expiry** — cancel `PENDING` online bookings whose payment was not completed within
   a short window so the dates are released (a scheduled job / Vercel Cron).
6. **Refunds** — when a paid booking is cancelled, call the provider's refund API and set
   `Payment.status = REFUNDED` from the refund webhook.
7. **Payouts** — start writing `Payout` rows (owner earnings per completed stay) and
   settle them through the provider's connected-accounts product.
8. **UI** — replace the disabled "Online payment — Coming soon" option in
   `src/app/(site)/checkout/page.tsx` with the live option.

Because the provider hosts the card form, HAVORA still never touches raw card data.
