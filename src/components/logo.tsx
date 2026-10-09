import Link from "next/link";
import { SITE_TAGLINE } from "@/lib/constants";

export function LogoMark({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <path d="M5 19.5 20 6l15 13.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 17v16.5h21V17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16.5 33.5V23.2c0-1.9 1.6-3.5 3.5-3.5s3.5 1.6 3.5 3.5v10.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M27 9.5V6.8h2.6v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ tone = "light", href = "/", compact = false }: { tone?: "light" | "dark"; href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2.5" aria-label="HAVORA home">
      <LogoMark className="size-9 text-gold-500 transition group-hover:text-gold-400" />
      <span className="flex flex-col leading-none">
        <span className={`font-serif text-[22px] font-medium tracking-[0.22em] ${tone === "light" ? "text-white" : "text-navy-900"}`}>
          HAVORA
        </span>
        {!compact && (
          <span className={`mt-1 hidden text-[8px] font-medium tracking-[0.3em] uppercase sm:block ${tone === "light" ? "text-navy-200" : "text-muted"}`}>
            {SITE_TAGLINE}
          </span>
        )}
      </span>
    </Link>
  );
}
