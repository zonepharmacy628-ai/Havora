import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, CalendarDays, Camera, ClipboardList, HandCoins, LayoutDashboard, ShieldCheck, Wallet } from "lucide-react";
import { HOST_IMAGE } from "@/lib/constants";
import { formatBps } from "@/lib/money";
import { getCurrentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "List Your Property",
  description: "Become a HAVORA host: list your villa, apartment, hotel or cabin and welcome guests from around the world.",
};

const STEPS = [
  { icon: ClipboardList, title: "Create your host account", text: "Register as a host in a couple of minutes. Hosting uses its own account, separate from guest bookings." },
  { icon: Camera, title: "Add your property", text: "Describe your place, set your nightly price and cleaning fee, choose amenities and add at least three photos." },
  { icon: CalendarDays, title: "Set your availability", text: "Block the dates you don't want to host. Bookings fill your calendar automatically, so there are no double bookings." },
  { icon: BadgeCheck, title: "Submit for review", text: "Our team reviews every new listing before it is published, to keep the collection trustworthy for guests." },
];

export default async function HostPage() {
  const [user, settings] = await Promise.all([getCurrentUser(), getSettings()]);
  const isHost = user?.role === "OWNER" || user?.role === "ADMIN";

  const cta = isHost ? (
    <Link href="/owner/properties/new" className="btn btn-gold btn-lg">
      Add a property <ArrowRight className="size-4" aria-hidden="true" />
    </Link>
  ) : user ? null : (
    <Link href="/host/register" className="btn btn-gold btn-lg">
      Start hosting <ArrowRight className="size-4" aria-hidden="true" />
    </Link>
  );

  return (
    <>
      <section className="relative isolate overflow-hidden bg-navy-950">
        <Image src={HOST_IMAGE} alt="Modern villa with a swimming pool" fill priority sizes="100vw" className="-z-20 object-cover" />
        <div className="hero-overlay absolute inset-0 -z-10" />
        <div className="container-page py-20 sm:py-28">
          <div className="animate-fade-up max-w-2xl">
            <p className="eyebrow mb-5 text-gold-400">Become a host</p>
            <h1 className="font-serif text-[40px] leading-[1.1] font-medium tracking-tight text-white sm:text-6xl">
              List your property on <em className="text-gold-400">HAVORA.</em>
            </h1>
            <p className="mt-5 max-w-lg text-[15px] leading-7 text-navy-200">
              Share your villa, apartment, hotel or cabin with travellers from around the world. You set the price and the rules; we bring the guests and the tools.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {cta}
              {isHost ? (
                <Link href="/owner" className="btn btn-ghost-light btn-lg">
                  <LayoutDashboard className="size-4" aria-hidden="true" /> Owner Dashboard
                </Link>
              ) : !user ? (
                <Link href="/login?next=/owner" className="btn btn-ghost-light btn-lg">
                  I already host — sign in
                </Link>
              ) : null}
            </div>
            {user && !isHost && (
              <p className="mt-6 max-w-lg rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm text-navy-200">
                You are signed in with a guest account, which cannot be used for hosting. To become a host, sign out and register a host account with a different email address, or{" "}
                <Link href="/contact" className="font-semibold text-gold-300 hover:underline">
                  contact our support team
                </Link>
                .
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="container-page py-16">
        <p className="eyebrow mb-2">How it works</p>
        <h2 className="heading-serif mb-10 text-3xl sm:text-4xl">From sign-up to your first guest</h2>
        <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, text }, index) => (
            <li key={title} className="card card-pad">
              <div className="mb-4 flex items-center justify-between">
                <span className="flex size-12 items-center justify-center rounded-xl bg-navy-800 text-gold-400">
                  <Icon className="size-6" aria-hidden="true" />
                </span>
                <span className="font-serif text-3xl font-medium text-cream-300">0{index + 1}</span>
              </div>
              <h3 className="font-serif text-lg font-medium text-ink">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-cream-200 bg-white">
        <div className="container-page grid gap-10 py-16 lg:grid-cols-3">
          <div>
            <Wallet className="mb-4 size-8 text-gold-600" aria-hidden="true" />
            <h3 className="heading-serif text-xl">Guests pay you directly</h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              HAVORA bookings are Pay at Property. Guests reserve online and pay you the booking total on arrival — you record the payment in your dashboard once it is collected.
            </p>
          </div>
          <div>
            <HandCoins className="mb-4 size-8 text-gold-600" aria-hidden="true" />
            <h3 className="heading-serif text-xl">Clear, simple commission</h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              HAVORA&apos;s commission is currently <strong className="text-ink">{formatBps(settings.commissionRateBps)}</strong> of the accommodation subtotal of each booking. Your dashboard shows the commission and your estimated earnings for every reservation.
            </p>
          </div>
          <div>
            <ShieldCheck className="mb-4 size-8 text-gold-600" aria-hidden="true" />
            <h3 className="heading-serif text-xl">You stay in control</h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              Choose instant booking or approve each request yourself, pick your cancellation policy, set minimum stays and pause your listing whenever you need to.
            </p>
          </div>
        </div>
      </section>

      <section className="container-page py-16 text-center">
        <h2 className="heading-serif text-3xl">Ready to welcome your first guests?</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted">
          {isHost ? "Add a property from your Owner Dashboard whenever you're ready." : "Create your host account, add your property and submit it for review."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {cta}
          {!user && (
            <Link href="/login?next=/owner" className="btn btn-outline btn-lg">
              Host sign in
            </Link>
          )}
          <Link href="/help" className="btn btn-outline btn-lg">
            Hosting questions
          </Link>
        </div>
      </section>
    </>
  );
}
