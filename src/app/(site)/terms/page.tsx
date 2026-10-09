import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Terms & Conditions" };

export default async function TermsPage() {
  const { supportEmail } = await getSettings();
  return (
    <>
      <PageHero eyebrow="Legal" title="Terms & Conditions" subtitle="The rules for using HAVORA as a guest or as a host." />
      <article className="prose-legal container-page max-w-3xl py-14">
        <p>
          These terms govern your use of the HAVORA website and services. By creating an account or making a booking you agree to them. Please read them together with our{" "}
          <Link href="/privacy">Privacy Policy</Link> and <Link href="/cancellation-policy">Cancellation Policy</Link>.
        </p>

        <h2>1. About HAVORA</h2>
        <p>
          HAVORA is an online marketplace where property owners (“hosts”) list accommodation and travellers (“guests”) reserve it. The contract for a stay is between the guest and the host. HAVORA provides the platform, reviews listings before publication and records bookings.
        </p>

        <h2>2. Accounts</h2>
        <ul>
          <li>You must be at least 18 years old and provide accurate information.</li>
          <li>You are responsible for keeping your password confidential and for activity on your account.</li>
          <li>We may suspend accounts that breach these terms, provide false information or misuse the service.</li>
        </ul>

        <h2>3. Bookings</h2>
        <ul>
          <li>Availability and prices are confirmed by our systems at the moment a booking is made. A booking exists only once you receive a booking reference.</li>
          <li>Some properties confirm instantly; others require the host to accept your request.</li>
          <li>You must comply with the property&apos;s house rules, guest limits and check-in and check-out times, which follow the property&apos;s local time.</li>
        </ul>

        <h2>4. Prices and payment</h2>
        <ul>
          <li>Prices are shown in US dollars and include the nightly rate, any cleaning fee and the HAVORA service fee, itemised before you reserve.</li>
          <li>
            HAVORA currently supports <strong>Pay at Property</strong> only: no payment is taken online, and the booking total is paid directly to the host on arrival.
          </li>
          <li>Local taxes or charges required by law at the destination may be collected by the host where applicable.</li>
        </ul>

        <h2>5. Cancellations</h2>
        <p>
          Cancellations are handled under the policy shown on the property page and at checkout, as described in our <Link href="/cancellation-policy">Cancellation Policy</Link>.
        </p>

        <h2>6. Hosts</h2>
        <ul>
          <li>Hosts must have the right to offer their property, describe it accurately and keep their calendar up to date.</li>
          <li>Hosts must only publish photos they own or are licensed to use.</li>
          <li>HAVORA charges hosts a commission on each booking, displayed in the host dashboard. Commission terms for a booking are fixed when the booking is made.</li>
        </ul>

        <h2>7. Reviews and content</h2>
        <p>
          Reviews may only be written by guests who completed a stay and must be honest and respectful. We may hide content that is unlawful, abusive, misleading or unrelated to the stay.
        </p>

        <h2>8. Liability</h2>
        <p>
          Hosts are responsible for their properties and for the services they provide. To the extent permitted by law, HAVORA is not liable for the acts or omissions of hosts or guests, or for indirect or consequential losses. Nothing in these terms limits rights you have under mandatory consumer law.
        </p>

        <h2>9. Changes and contact</h2>
        <p>
          We may update these terms and will post the new version here. Questions? Email <a href={`mailto:${supportEmail}`}>{supportEmail}</a> or use our <Link href="/contact">contact form</Link>.
        </p>
      </article>
    </>
  );
}
