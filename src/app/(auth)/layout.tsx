import Image from "next/image";
import { BadgeCheck, Headset, Wallet } from "lucide-react";
import { Logo } from "@/components/logo";
import { AUTH_IMAGE } from "@/lib/constants";

const POINTS = [
  { icon: BadgeCheck, label: "Reviewed listings" },
  { icon: Wallet, label: "Pay at property" },
  { icon: Headset, label: "Dedicated support" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative isolate flex min-h-screen flex-1 flex-col bg-navy-950">
      <Image src={AUTH_IMAGE} alt="" fill priority sizes="100vw" className="-z-20 object-cover" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-navy-950/95 via-navy-950/75 to-navy-950/40" />

      <div className="container-page flex items-center justify-between py-6">
        <Logo />
      </div>

      <div className="container-page grid flex-1 items-center gap-10 pb-12 lg:grid-cols-2">
        <div className="hidden lg:block">
          <p className="eyebrow mb-5 text-gold-400">Welcome to HAVORA</p>
          <h2 className="font-serif text-5xl leading-[1.1] font-medium text-white">
            Your next getaway
            <br />
            is just a <em className="text-gold-400">login</em> away.
          </h2>
          <ul className="mt-10 flex gap-8">
            {POINTS.map(({ icon: Icon, label }) => (
              <li key={label} className="flex flex-col items-start gap-2 text-xs font-medium text-navy-200">
                <span className="flex size-11 items-center justify-center rounded-full border border-gold-500/40 text-gold-400">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>
        <div className="mx-auto w-full max-w-md">{children}</div>
      </div>
    </main>
  );
}
