import Link from "next/link";
import { Compass } from "lucide-react";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <main className="navy-texture flex min-h-screen flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <Logo />
      <Compass className="mt-12 size-12 text-gold-500" aria-hidden="true" />
      <p className="eyebrow mt-6 text-gold-400">Error 404</p>
      <h1 className="mt-3 font-serif text-4xl font-medium text-white sm:text-5xl">This page has checked out.</h1>
      <p className="mt-4 max-w-md text-[15px] leading-7 text-navy-200">
        The page you are looking for doesn&apos;t exist or is no longer available. Let&apos;s get you back to somewhere beautiful.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn btn-gold btn-lg">
          Back to home
        </Link>
        <Link href="/properties" className="btn btn-ghost-light btn-lg">
          Explore properties
        </Link>
      </div>
    </main>
  );
}
