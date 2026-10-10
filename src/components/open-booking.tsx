"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, LockKeyhole } from "lucide-react";
import { openBookingAction } from "@/actions/booking";

/**
 * Landing page for private booking links. The key is read from the URL
 * fragment (never sent to the server in a URL), exchanged for a secure cookie,
 * and removed from the address bar before the booking is shown.
 */
export function OpenBooking() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    function open() {
      const fragment = window.location.hash.slice(1);
      // Clear the key from the address bar and history straight away.
      window.history.replaceState(null, "", window.location.pathname);
      const dot = fragment.indexOf(".");
      if (dot === -1) {
        setFailed(true);
        return;
      }
      setFailed(false);
      openBookingAction(fragment.slice(0, dot), fragment.slice(dot + 1))
        .then((result) => {
          if (cancelled) return;
          if (result.ok) router.replace(`/booking/${result.reference}`);
          else setFailed(true);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
    }

    // Also handle a link pasted into the address bar while this page is already open.
    const onHashChange = () => {
      if (window.location.hash.length > 1) open();
    };
    window.addEventListener("hashchange", onHashChange);
    open();
    return () => {
      cancelled = true;
      window.removeEventListener("hashchange", onHashChange);
    };
  }, [router]);

  return (
    <div className="card mx-auto flex max-w-lg flex-col items-center px-6 py-14 text-center">
      <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-gold-50 text-gold-600 ring-1 ring-gold-100">
        {failed ? <LockKeyhole className="size-6" aria-hidden="true" /> : <Loader2 className="size-6 animate-spin" aria-hidden="true" />}
      </span>
      {failed ? (
        <>
          <h1 className="heading-serif text-2xl">This booking link didn&apos;t work</h1>
          <p className="mt-2 text-sm text-muted">
            The link may be incomplete, out of date, or opened too many times in a short period. You can request a fresh private link using your booking reference and email address.
          </p>
          <Link href="/bookings" className="btn btn-gold mt-6">
            Find my booking
          </Link>
        </>
      ) : (
        <>
          <h1 className="heading-serif text-2xl">Opening your booking…</h1>
          <p className="mt-2 text-sm text-muted" role="status">
            Checking your private link.
          </p>
        </>
      )}
    </div>
  );
}
