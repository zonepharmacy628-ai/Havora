import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Privacy Policy" };

export default async function PrivacyPage() {
  const { supportEmail } = await getSettings();
  return (
    <>
      <PageHero eyebrow="Legal" title="Privacy Policy" subtitle="What we collect, why we collect it and the choices you have." />
      <article className="prose-legal container-page max-w-3xl py-14">
        <p>This policy explains how HAVORA handles personal information when you browse the site, book a stay as a guest, or create a host account to list a property.</p>

        <h2>Information we collect</h2>
        <ul>
          <li>
            <strong>Host account details</strong> — for hosts (and existing account holders): your name, email address, and optionally your phone number, country and a short bio. Guests do not need an account.
          </li>
          <li>
            <strong>Booking details</strong> — the property, dates, number of guests, the names of people in your party, contact details and any special requests.
          </li>
          <li>
            <strong>Listing details</strong> — for hosts, the property information, address and photos you provide.
          </li>
          <li>
            <strong>Technical data</strong> — your IP address and browser type, used for security and to limit abusive requests.
          </li>
        </ul>
        <p>We do not collect or store payment card details. HAVORA does not process online payments at this time.</p>

        <h2>How we use it</h2>
        <ul>
          <li>To create and secure host accounts and keep account holders signed in.</li>
          <li>To make, manage and display bookings, and to share the details a host needs to welcome you.</li>
          <li>To review listings, moderate reviews and prevent fraud or misuse.</li>
          <li>To answer messages you send us and, if you subscribe, to send our newsletter.</li>
        </ul>

        <h2>Who we share it with</h2>
        <ul>
          <li>
            <strong>Hosts and guests</strong> — a host sees the guest&apos;s name, contact details and requests for a booking; the guest sees the property address and host contact details once a booking is confirmed.
          </li>
          <li>
            <strong>Service providers</strong> — hosting, database, image storage and email delivery providers that process data on our behalf.
          </li>
          <li>
            <strong>Authorities</strong> — where we are legally required to do so.
          </li>
        </ul>
        <p>We do not sell your personal information.</p>

        <h2>Cookies</h2>
        <p>
          We use essential cookies only: one keeps hosts and account holders signed in, and one remembers the bookings you have made or opened on this device so you can return to them without a password. Your wishlist is kept in your browser&apos;s local storage on your device and is not sent to our servers as a saved list. We do not use advertising or third-party tracking cookies.
        </p>

        <h2>Private booking links</h2>
        <p>
          Each guest booking has a private link that we show on the confirmation page and email to the address you provide. A booking reference alone does not reveal booking details. Please keep your link private; if you believe it has been shared, contact us and we will issue a new one.
        </p>

        <h2>Security and retention</h2>
        <p>
          Passwords are stored only as salted cryptographic hashes. Access to booking and account data is restricted by role, and important administrative actions are logged. We keep booking records for as long as needed to operate the service and meet legal obligations.
        </p>

        <h2>Your choices</h2>
        <p>
          Hosts can update their profile from their dashboard settings at any time. To request a copy of your data, a correction, or deletion of your booking details or account, email <a href={`mailto:${supportEmail}`}>{supportEmail}</a> or use our{" "}
          <Link href="/contact">contact form</Link>.
        </p>
      </article>
    </>
  );
}
