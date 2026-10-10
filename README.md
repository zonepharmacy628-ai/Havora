# HAVORA — Luxury Stays Booking Marketplace

A full-stack accommodation marketplace: guests search and reserve villas, apartments,
hotels and cabins; property owners list and manage them; administrators run the platform.

Built with **Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 ·
PostgreSQL · Prisma 6 · Better Auth**. Deploys to **Vercel**.

> **Payments:** this release is **Pay at Property only**. No online payment gateway is
> integrated, no card data is collected, and nothing is ever marked as paid automatically.
> See [docs/PAYMENTS.md](docs/PAYMENTS.md).

---

## Contents

1. [Features](#features)
2. [Run it locally](#run-it-locally)
3. [Accounts and roles](#accounts-and-roles)
4. [Environment variables](#environment-variables)
5. [Scripts](#scripts)
6. [Project structure](#project-structure)
7. [How bookings stay correct](#how-bookings-stay-correct)
8. [Security](#security)
9. [Deploy to GitHub + Vercel](#deploy-to-github--vercel)
10. [Production checklist](#production-checklist)
11. [Post-deployment smoke tests](#post-deployment-smoke-tests)
12. [Going live with real data](#going-live-with-real-data)
13. [Testing](#testing)
14. [Known limitations](#known-limitations)

---

## Features

**Guests** — homepage with destination/date/guest search · property search with working
filters (type, price, amenities, rating, dates, guests), sorting and pagination · property
page with gallery, amenities, sleeping arrangements, house rules, availability calendar,
live price breakdown, reviews and similar stays · checkout · booking confirmation with a
unique reference · my bookings, booking details, cancellations and cancellation requests ·
wishlist · reviews for completed stays · profile and password settings · password reset.

**Property owners** — dashboard with real stats and earnings chart · create/edit listings ·
photo management (upload via Cloudinary, or add by link) with reordering and cover photo ·
availability calendar and date blocking · reservations (confirm/decline requests, handle
cancellation requests, mark completed/no-show, record payment collected at the property) ·
earnings with platform commission breakdown · listing submission and review workflow.

**Administrators** — platform overview · user management (roles, suspension) · listing
approvals, rejections with feedback, unpublishing and featuring · all bookings · review
moderation · reports calculated from real data · commission and service-fee settings ·
contact-form inbox · audit log of important actions.

**Also** — About, Contact, Help/FAQ, Terms, Privacy, Cancellation Policy, custom 404 and
error pages, newsletter sign-up, responsive layouts for desktop, tablet and mobile.

---

## Run it locally

Requirements: **Node.js 20.9+** and npm. No Docker and no PostgreSQL install needed —
the project ships a local Postgres-compatible database for development.

```bash
npm install
```

Create your environment file and set the secrets (see [Environment variables](#environment-variables)):

```bash
cp .env.example .env
```

At minimum, edit `.env` and set `BETTER_AUTH_SECRET`, `SEED_ADMIN_EMAIL`,
`SEED_ADMIN_PASSWORD` and `SEED_DEMO_PASSWORD` to real values (10+ characters for passwords).

Start the local database (leave this terminal running):

```bash
npm run db:local
```

In a second terminal, create the tables and load demo data, then start the site:

```bash
npm run db:deploy
```

```bash
npm run db:seed
```

```bash
npm run dev
```

Open <http://localhost:3000>.

> **About the local database.** `npm run db:local` runs [PGlite](https://pglite.dev)
> (PostgreSQL compiled to WebAssembly) behind a normal Postgres port, storing data in
> `./.data/pglite`. It is for development only. Delete the `.data` folder to start fresh.
> It is a single-session engine, so use `npm run db:deploy` (not `prisma migrate dev`)
> against it. To author new migrations, point `DATABASE_URL`/`DIRECT_URL` at a real
> PostgreSQL database (for example a free Neon development branch) and run
> `npm run db:migrate`.

---

## Accounts and roles

| Role | How it is obtained | Can access |
| --- | --- | --- |
| Guest | Not signed in — **no account needed** | Public pages, search, property details, **checkout**, their own bookings via a private link, browser wishlist |
| Legacy customer | Accounts created before guest checkout (public customer sign-up has been removed) | Sign in to see bookings linked to the account at `/bookings` — no dashboard |
| Property owner | Register at `/host/register` (the only public sign-up; the role is fixed on the server) | Owner Dashboard `/owner/*` for **their own** listings and reservations |
| Administrator | Granted to one existing account through the `ADMIN_EMAIL` deployment setting (or the seed script locally). No public registration. | Admin Panel `/admin/*`, every listing and booking, plus their own listings in the Owner Dashboard |

`npm run db:seed` creates:

- the administrator from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`;
- **demo** owners and customers with `@havora.test` emails, all using `SEED_DEMO_PASSWORD`
  (for example `sarah.owner@havora.test` and `john.customer@havora.test`);
- 13 demo listings (12 published, 1 waiting for admin review) with past stays and reviews.

The seed is idempotent: reference data and the admin are upserted, and demo content is only
created when the database has no properties. Use `npm run db:seed -- --no-demo` to create
only the reference data and the administrator.

---

## Environment variables

Copy `.env.example` to `.env`. **Never commit `.env`** — it is git-ignored.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL URL used by the app. In production use the **pooled** connection string. |
| `DIRECT_URL` | Yes | PostgreSQL URL used by Prisma Migrate. In production use the **direct / unpooled** string. Locally it is the same as `DATABASE_URL`. |
| `BETTER_AUTH_SECRET` | Yes | Secret used to sign sessions. Generate with `openssl rand -base64 32`. |
| `BETTER_AUTH_URL` | Yes (prod) | Public site URL, e.g. `https://havora.vercel.app` (no trailing slash). |
| `NEXT_PUBLIC_APP_URL` | Yes (prod) | Same public site URL (used for metadata and trusted origins). |
| `ADMIN_EMAIL` | Recommended (prod) | The one registered account that is granted administrator rights at each deployment. |
| `SEED_ADMIN_EMAIL` | For seeding | Email of the administrator account created by the seed. |
| `SEED_ADMIN_PASSWORD` | For seeding | Password for that administrator (10+ characters). |
| `SEED_DEMO_PASSWORD` | For demo seed | Shared password for the `@havora.test` demo accounts. |
| `RESEND_API_KEY` | Optional | Enables real password-reset emails through [Resend](https://resend.com). |
| `EMAIL_FROM` | With Resend | Verified sender, e.g. `HAVORA <no-reply@your-domain.com>`. |
| `CLOUDINARY_CLOUD_NAME` | Optional | Enables owner photo uploads through [Cloudinary](https://cloudinary.com). |
| `CLOUDINARY_API_KEY` | With Cloudinary | Cloudinary API key. |
| `CLOUDINARY_API_SECRET` | With Cloudinary | Cloudinary API secret (server-side only). |

Without the optional integrations the site still works: password-reset links are written to
the server log in development (and not sent in production), and owners add photos by link.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Generate the Prisma client and build for production |
| `npm run vercel-build` | Used by Vercel: generate client, **apply migrations**, build |
| `npm start` | Run the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit + integration tests (spins up its own in-memory database) |
| `npm run db:local` | Start the local development database |
| `npm run db:deploy` | Apply migrations to the database in `DIRECT_URL` |
| `npm run db:migrate` | Create a new migration (needs a real PostgreSQL database) |
| `npm run db:seed` | Seed reference data, the admin and demo content |
| `npm run db:remove-demo -- --yes` | Delete all `@havora.test` demo accounts and their data |
| `npm run db:studio` | Open Prisma Studio |

---

## Project structure

```
prisma/
  schema.prisma            Database models, enums, indexes, relations
  migrations/              SQL migrations (schema + integrity constraints)
  seed.ts                  Reference data, admin account, demo content
scripts/
  dev-db.ts                Local development database
  remove-demo.ts           Removes demo accounts and content
src/
  actions/                 Server actions (auth, booking, owner, admin, misc)
  app/
    (site)/                Public pages: home, search, property, checkout, booking, content
    (auth)/                Login, register, forgot/reset password
    account/               Customer dashboard
    owner/                 Property-owner dashboard
    admin/                 Administrator dashboard
    api/auth/[...all]/     Better Auth HTTP endpoints
  components/              Reusable UI (design system, forms, cards, calendar, shells)
  lib/                     Domain logic: bookings, pricing, rules, dates, money, auth, validation
tests/                     Vitest unit and integration tests
docs/PAYMENTS.md           Payment architecture and how to add a gateway later
```

The design system (navy / gold / warm-white palette, serif headings, buttons, inputs,
cards, badges, tables) lives in `src/app/globals.css` and `src/components/ui.tsx`.

---

## How bookings stay correct

- **Prices are never taken from the browser.** The checkout form submits only the property
  id, dates, guest counts and contact details. `createBooking()` recalculates the price from
  database values inside the transaction (`src/lib/bookings.ts`, `src/lib/pricing.ts`).
- **Money is integer cents** everywhere; percentages are basis points.
- **No double bookings.** Inside one transaction the property row is locked
  (`SELECT … FOR UPDATE`), availability is re-checked against bookings and owner blocks, and
  the booking is inserted. As a final backstop a PostgreSQL **exclusion constraint**
  (`Booking_no_overlap`) makes overlapping active bookings impossible at the database level.
- **Dates are calendar dates** (`DATE` columns), half-open — a check-out day can be the next
  guest's check-in. "Today" is evaluated in the property's own timezone.
- **Booking status and payment status are separate.** A status state machine
  (`src/lib/booking-rules.ts`) defines which role may make each transition.
- **Cancellation rules.** Each listing has a Flexible / Moderate / Strict policy. Inside the
  free window the guest cancels directly; afterwards they send a request the host decides.
- **Commission is snapshotted** on each booking, so changing platform rates never rewrites
  existing bookings.

---

## Guest bookings, private links and dashboards

HAVORA has **two dashboards only**: the Owner Dashboard (`/owner`) and the Admin Dashboard (`/admin`).
There is no customer dashboard.

- **Guest checkout.** Anyone can book without an account by entering a name, email and phone.
  Prices and availability are still calculated and checked on the server, inside the same
  transaction and behind the same database overlap constraint as before.
- **Duplicate submissions.** Each checkout page view carries an idempotency key; submitting the
  same checkout twice (double-click, retry, back button) returns the same booking.
- **Private booking links.** A booking reference (`HV-XXXXXXXX`) is an identifier, not a password,
  and never opens booking details by itself. Guests get a private link containing a 256-bit key
  (an HMAC signed with `BETTER_AUTH_SECRET`; nothing secret is stored in the database). The key
  travels in the URL fragment, is exchanged for an HttpOnly cookie and is removed from the address
  bar. Changing `BETTER_AUTH_SECRET` invalidates all existing private links.
- **Finding a booking.** `/bookings` lists bookings made or opened on the device. "Find my booking"
  takes a reference and email and — if they match — emails a fresh private link to the address on
  the booking. Responses are identical whether or not a booking exists, and are rate-limited.
  **This requires email delivery (Resend) to be configured.**
- **Revoking a link.** An administrator can reset a booking's private link from the booking page.
- **Abuse limits.** Guest bookings are rate-limited per IP and per email, capped at 4 upcoming
  bookings per email address, and the checkout form contains a honeypot field.
- **Guest reviews.** The guest who booked can review a completed stay once, shown publicly as
  first name and last initial only.
- **Wishlist.** Stored in the visitor's browser (`localStorage`), so it needs no account. It is per
  browser and per device, is not synced, and is lost if browsing data is cleared.
- **Legacy accounts.** Existing customer accounts, bookings and reviews are untouched. Legacy
  customers can still sign in and see their linked bookings at `/bookings`. Old `/account/...`
  addresses redirect to the matching page.
- **Administrators as hosts.** The administrator is the website owner and has full authority: they
  can add and manage their own properties in the Owner Dashboard with the same account, and can
  approve, publish, feature, unpublish and delete any listing — including their own — without a
  second administrator. Every such action is written to the audit log (own listings are marked).
  Property owners can never approve or publish past review: listing approval is admin-only and
  checked on the server.
- **Reaching the Admin Dashboard.** It is not linked from the public site or the Owner Dashboard.
  The administrator types its address (`/admin`), signs in, and is returned to it. There is no
  public administrator registration.
- **Booking emails.** When Resend is configured, HAVORA emails the guest a confirmation with the
  private link, notifies the host of new bookings and requests, and notifies each side of
  cancellations and status changes. Without Resend none of these are sent.

## Email delivery

HAVORA sends plain-text transactional email through [Resend](https://resend.com) when both
`RESEND_API_KEY` and `EMAIL_FROM` are set. `EMAIL_FROM` must use a domain verified in Resend,
for example `HAVORA <bookings@your-domain.com>`.

| Email | Sent to | When |
| --- | --- | --- |
| Booking confirmation / request received (with the private link) | Guest | A booking is created |
| New booking / new request | Host | A booking is created |
| Booking-link recovery | Guest (the address on the booking) | "Find my booking" matches, or an admin resets the link |
| Status update (confirmed, declined, cancelled) | Guest | The host or an admin changes the booking |
| Guest cancelled / cancellation requested | Host | The guest cancels or asks to cancel |
| Password reset | Account holder | "Forgot password" |
| Test email | The signed-in administrator only | Admin → Settings → "Send test email" |

**The site never claims an email was sent unless the provider accepted it.**

- A booking is saved first; an email problem never cancels or undoes it.
- The confirmation page shows one of three states: sent to the guest's address, **could not be
  sent**, or **no email is sent** (not configured). In every case the private booking link is shown
  on the page with a copy button, and the booking stays listed under My Bookings on that device.
- Failed confirmation and recovery emails are written to the audit log as `email.failed`.
- "Find my booking" always gives the same reply for matching and non-matching details and sends
  after replying, so neither the text nor the response time reveals whether a booking exists. If
  email is not configured at all, it says so instead of promising a message.
- Password reset says it is unavailable when email is not configured, instead of promising a link.
- Sending waits at most 8 seconds for the provider.
- To verify delivery without emailing any guest, use Admin → Settings → **Send test email**; it goes
  only to your own administrator address and reports whether the provider accepted it.

## Administrator access

- **Admin Login URL:** `/admin/login` (typing `/admin` while signed out leads there). It is not linked
  from the public site or the Owner Dashboard, and search engines are told not to index it.
- **Who can sign in there:** only accounts that already hold the administrator role. The role is
  checked *before* a session is created, and the same message is shown for an unknown email, a
  wrong password and a non-administrator account. Attempts are rate-limited and audit-logged.
- **How an account becomes administrator:** there is no administrator registration. Set the
  `ADMIN_EMAIL` environment variable (one address) in Vercel. At the end of each deployment,
  `scripts/ensure-admin.ts` grants the administrator role to the account registered with that
  address. It only promotes an account that already exists and is active; it never creates an
  account and never sets or changes a password. The change is written to the audit log.
  1. Register on the live site (`/host/register`) with your own email and password.
  2. Confirm you can sign in.
  3. Set `ADMIN_EMAIL` to that address in Vercel → Settings → Environment Variables (Production).
  4. Redeploy. Then sign in at `/admin/login`.
- **After that**, other administrators can be added or removed in Admin → Users.
- **View Website:** both dashboards have a "View Website" button that opens the public site in a
  new tab. The public site shows only published listings, whoever is signed in — drafts and
  listings waiting for review stay hidden (owners and administrators can use "Preview" on a
  listing to see their own unpublished one).

## Property categories

Categories are stored in the database (`Category` table), not in the code. There is **no
separate category-management page**: everything happens inside the Add / Edit Property form.

- **"+ Create New Category"** sits beside the Category selector. It opens a small dialog (name,
  optional description, optional image) without leaving the form; every other field keeps its value.
- **Administrators** create a category directly. It is saved, added to the dropdown and selected for
  the property being edited straight away, and is available to every host.
- **Property owners** can only submit a request. It is stored as *pending*, shown (disabled) in
  their dropdown with a "pending approval" label, and cannot be used on a listing until approved.
  Owners may have up to 3 open requests.
- **Approving requests.** An administrator sees owners' requests in the same place — under the
  Category selector of their own Add / Edit Property form — and approves or declines them there.
  An approved category then appears in every host's dropdown.
- **Rules enforced on the server:** the role decides whether a category is created or only requested;
  names are unique regardless of letter case and slugs are unique (also enforced by database
  indexes); a listing can only be saved with a live category; all actions are audit-logged.
- **Images** use the same signed Cloudinary upload as listing photos when Cloudinary is configured;
  otherwise an image link from an approved host can be pasted.
- The six original categories (Villa, Apartment, Hotel, Beach house, Cabin, Resort) are created by
  the migration, and every existing listing is linked to its matching category.

## Security

- Passwords are hashed by Better Auth (scrypt); sessions are stored in the database and sent
  in an `HttpOnly`, `SameSite=Lax` cookie that is `Secure` in production.
- Every page under `/owner` and `/admin` checks the session and role **on the
  server**, and every server action re-checks it. Hiding a button is never the only control.
- Ownership is verified on the server for every listing and booking operation. Requests for
  other people's records return "not found".
- The role can never be set through sign-up or profile forms. Only an administrator can
  grant the administrator role.
- Suspended accounts are signed out immediately and cannot sign in.
- All input is validated with Zod on the server. Database access goes through Prisma
  (parameterised queries); the few raw queries use tagged templates.
- Sensitive actions (sign-in, sign-up, password reset, booking, contact, newsletter) are
  rate-limited with a database-backed limiter that works across serverless instances.
- Server actions are protected against CSRF by Next.js origin checks; security headers
  (HSTS, `X-Frame-Options`, `nosniff`, referrer and permissions policies) are set globally.
- Errors shown to users are generic; details are logged on the server only.
- Important actions are written to an audit log visible to administrators.

---

## Deploy to GitHub + Vercel

You need free accounts on [GitHub](https://github.com), [Vercel](https://vercel.com) and a
managed PostgreSQL provider. These steps use [Neon](https://neon.tech), which works well
with Vercel and Prisma.

### 1. Push the code to GitHub

1. On GitHub click **+ → New repository**. Name it `havora`, choose **Private**, and do
   **not** add a README or .gitignore. Click **Create repository**.
2. In a terminal inside this project folder run the commands GitHub shows under
   "…or push an existing repository", for example:

```bash
git remote add origin https://github.com/YOUR-USERNAME/havora.git
```

```bash
git push -u origin main
```

`.env` is git-ignored, so no secrets are uploaded. Check that only `.env.example` appears on GitHub.

### 2. Create the production database

1. Sign in to Neon and click **New Project**. Pick a region close to your customers.
2. Open **Connection Details** and copy two connection strings:
   - **Pooled connection** (the host contains `-pooler`) → this is `DATABASE_URL`
   - **Direct connection** (untick "Connection pooling") → this is `DIRECT_URL`

### 3. Import the project into Vercel

1. In Vercel click **Add New… → Project** and import your `havora` GitHub repository.
2. Leave the framework as **Next.js**. The build command comes from `vercel.json`.
3. Open **Environment Variables** and add (for *Production* and *Preview*):

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | Neon pooled connection string |
   | `DIRECT_URL` | Neon direct connection string |
   | `BETTER_AUTH_SECRET` | A new long random string (`openssl rand -base64 32`) |
   | `BETTER_AUTH_URL` | `https://YOUR-PROJECT.vercel.app` |
   | `NEXT_PUBLIC_APP_URL` | `https://YOUR-PROJECT.vercel.app` |

   Optional: `RESEND_API_KEY`, `EMAIL_FROM`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`,
   `CLOUDINARY_API_SECRET`.
4. Click **Deploy**. The build runs `prisma migrate deploy`, which creates all tables in
   your production database automatically, then builds the site.

If you do not know the final URL yet, deploy once, copy the URL Vercel gives you, update
`BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL`, then **Redeploy**.

### 4. Create the administrator (and optional demo data)

The seed is run once from your computer against the production database.

1. Temporarily put the **production** `DATABASE_URL` and `DIRECT_URL` in your local `.env`,
   and set `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` to the real admin login you want.
2. Run one of:

```bash
npm run db:seed -- --no-demo
```

   (administrator, amenities and settings only — recommended for a real launch), or
   `npm run db:seed` to also load the demo listings.
3. Put your local development values back in `.env` afterwards.

### 5. Later changes

Push to `main` and Vercel redeploys automatically. Any new migration files in
`prisma/migrations` are applied during the build.

---

## Production checklist

- [ ] `BETTER_AUTH_SECRET` is a unique random value (not the development one).
- [ ] `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` match the live URL exactly (https, no trailing slash).
- [ ] `DATABASE_URL` is the pooled string and `DIRECT_URL` the direct string.
- [ ] The administrator password is strong and stored in a password manager.
- [ ] Demo accounts are removed, or you have consciously decided to keep them (see below).
- [ ] Support email, commission and service fee are set in **Admin → Settings**.
- [ ] Email is configured (Resend) so password reset works for real users.
- [ ] Cloudinary is configured if owners should upload photo files.
- [ ] Terms, Privacy and Cancellation Policy pages have been reviewed for your business and
      jurisdiction (the included text is a sensible starting point, not legal advice).
- [ ] A custom domain is attached in Vercel and the two URL variables updated to it.

---

## Post-deployment smoke tests

Run through these on the live URL after every first deploy:

1. Home page loads with photos; the header shows **Sign in / Get Started**.
2. **Properties** shows listings; ticking a filter changes the results and the URL.
3. Open a property → pick dates on the calendar → the price breakdown appears.
4. **Book Now** while signed out → you are sent to the login page and returned to checkout.
5. Register a new customer → complete a booking → you get an `HV-XXXXXXXX` reference,
   status **Confirmed**, payment **Unpaid**.
6. The same dates now show as unavailable on that property's calendar.
7. Visiting `/admin` and `/owner` while signed out redirects to the login page; a booking URL without its private link redirects to `/bookings`.
8. Sign in as the administrator → `/admin` shows the new booking and user.
9. In **Admin → Audit Logs** the booking and sign-up are listed.
10. Register a host at `/host/register` → you land on `/owner`; add a property, 3 photos, and submit it for review.

---

## Going live with real data

The demo content exists so the site can be explored end to end. Before inviting real
customers, remove it:

```bash
npm run db:remove-demo -- --yes
```

This deletes every `@havora.test` account with their listings, bookings, payments and
reviews. It refuses to run if a real customer has booked a demo listing. Amenities, platform
settings and your administrator account are kept.

---

## Testing

```bash
npm test
```

runs 88 tests with Vitest:

- **Unit** — pricing, money parsing, date maths and timezones, stay validation, booking
  status state machine, cancellation rules, role/ownership permissions, input validation.
- **Integration** (real PostgreSQL engine in memory, production migrations applied) —
  booking creation with server-side pricing, overlap rejection, back-to-back stays,
  simultaneous requests, the database exclusion constraint, capacity/date validation,
  refusal of online payment, unpublished/blocked/self/suspended-owner bookings, status
  transitions, payment voiding on cancellation.

The test run starts its own throwaway database on port 54331; your development data is not touched.

---

## Known limitations

- **No online payments** (by design for this release) and therefore no automatic refunds or
  owner payouts. Commission settlement with hosts is manual. See `docs/PAYMENTS.md`.
- **Email** (password reset, booking confirmations with the private link, host notifications) is only
  sent when Resend is configured. Until then a guest who loses their private link cannot recover
  the booking by themselves.
- **Guest bookings are not email-verified** and there is no CAPTCHA; protection against fake
  bookings relies on rate limits, the per-email cap and hosts/admins cancelling abusive bookings.
- **Email verification** on sign-up is not enforced.
- **Single currency** — prices are stored and shown in USD. The schema stores a currency per
  listing/booking so more can be added; no currency conversion is performed.
- **No maps or geocoding** — listings store address, country code and optional
  latitude/longitude so a provider can be plugged in later.
- **One nightly rate per listing** — no seasonal pricing, discounts or taxes.
- **Pagination** of very large admin lists is basic (most lists show the latest 100–200 rows).
- The local development database (PGlite) is not a substitute for testing against real
  PostgreSQL before launch; true multi-connection concurrency is only exercised on a real server.
