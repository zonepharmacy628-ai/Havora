import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, LifeBuoy, Mail } from "lucide-react";
import { contactAction } from "@/actions/misc";
import { ActionForm, SubmitButton, TextAreaField, TextField } from "@/components/forms";
import { PageHero } from "@/components/page-hero";
import { getCurrentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Contact", description: "Get in touch with the HAVORA team." };

export default async function ContactPage() {
  const [user, settings] = await Promise.all([getCurrentUser(), getSettings()]);

  return (
    <>
      <PageHero eyebrow="Contact" title="We're here to help." subtitle="Questions about a booking, hosting or your account? Send us a message and our team will reply by email." />
      <div className="container-page grid gap-8 py-14 lg:grid-cols-[1fr_340px]">
        <section className="card card-pad">
          <h2 className="mb-5 font-serif text-xl font-medium text-ink">Send a message</h2>
          <ActionForm action={contactAction} className="grid gap-4 sm:grid-cols-2" resetOnSuccess>
            <TextField name="name" label="Your name" defaultValue={user?.name} autoComplete="name" required />
            <TextField name="email" label="Email address" type="email" defaultValue={user?.email} autoComplete="email" required />
            <TextField name="subject" label="Subject" maxLength={120} required className="sm:col-span-2" />
            <TextAreaField name="message" label="Message" rows={6} maxLength={3000} required hint="If this is about a booking, include your reference (e.g. HV-AB12CD34)." className="sm:col-span-2" />
            <div className="sm:col-span-2">
              <SubmitButton pendingText="Sending…">Send message</SubmitButton>
            </div>
          </ActionForm>
        </section>

        <aside className="space-y-4">
          <div className="card card-pad">
            <Mail className="mb-3 size-6 text-gold-600" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-ink">Email us</h2>
            <a href={`mailto:${settings.supportEmail}`} className="mt-1 block text-sm font-medium break-all text-gold-700 hover:underline">
              {settings.supportEmail}
            </a>
          </div>
          <div className="card card-pad">
            <CalendarCheck className="mb-3 size-6 text-gold-600" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-ink">Manage a booking</h2>
            <p className="mt-1 text-sm text-muted">View details, cancel or request a cancellation from your account.</p>
            <Link href="/account/bookings" className="mt-2 inline-block text-sm font-semibold text-gold-700 hover:underline">
              Go to My Bookings
            </Link>
          </div>
          <div className="card card-pad">
            <LifeBuoy className="mb-3 size-6 text-gold-600" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-ink">Help Center</h2>
            <p className="mt-1 text-sm text-muted">Answers to common questions about booking, payment and hosting.</p>
            <Link href="/help" className="mt-2 inline-block text-sm font-semibold text-gold-700 hover:underline">
              Browse the FAQ
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}
