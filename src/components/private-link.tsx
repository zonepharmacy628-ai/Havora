"use client";

import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";

/** Shows the guest their private booking link with a copy button. */
type Props = {
  link: string;
  /** What happened to the confirmation email for this booking, when known. */
  mail: "sent" | "failed" | "off" | null;
  email: string;
};

export function PrivateLink({ link, mail, email }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="card card-pad" aria-labelledby="private-link">
      <h2 id="private-link" className="mb-1 flex items-center gap-2 font-serif text-lg font-medium text-ink">
        <KeyRound className="size-5 text-gold-600" aria-hidden="true" /> Your private booking link
      </h2>
      <p className="text-sm text-muted">
        This link opens your booking on any device — no account or password. Keep it private: anyone with the link can view and cancel this booking.
      </p>
      {mail === "sent" && (
        <p role="status" className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
          A confirmation with this link has been sent to <strong>{email}</strong>. If it doesn&apos;t arrive, check your spam folder — and copy the link below to be safe.
        </p>
      )}
      {mail === "failed" && (
        <p role="alert" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900">
          <strong>Your booking is saved, but we could not send your confirmation email.</strong> Please copy and save this link now — it is the way back to your booking.
        </p>
      )}
      {mail === "off" && (
        <p role="alert" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900">
          <strong>No confirmation email is sent for this booking.</strong> Please copy and save this link now — it is the way back to your booking.
        </p>
      )}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input readOnly value={link} aria-label="Private booking link" onFocus={(event) => event.currentTarget.select()} className="input flex-1 font-mono text-xs" />
        <button type="button" onClick={copy} className="btn btn-navy shrink-0">
          {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
    </section>
  );
}
