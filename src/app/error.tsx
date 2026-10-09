"use client";

import Link from "next/link";
import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="navy-texture flex min-h-screen flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <TriangleAlert className="size-12 text-gold-500" aria-hidden="true" />
      <p className="eyebrow mt-6 text-gold-400">Something went wrong</p>
      <h1 className="mt-3 font-serif text-4xl font-medium text-white">We couldn&apos;t load this page.</h1>
      <p className="mt-4 max-w-md text-[15px] leading-7 text-navy-200">
        An unexpected error occurred on our side. Please try again — if it keeps happening, contact our support team.
      </p>
      {error.digest && <p className="mt-3 text-xs text-navy-300">Reference: {error.digest}</p>}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="btn btn-gold btn-lg">
          Try again
        </button>
        <Link href="/" className="btn btn-ghost-light btn-lg">
          Back to home
        </Link>
      </div>
    </main>
  );
}
