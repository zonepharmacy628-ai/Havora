import Link from "next/link";
import type { ReactNode } from "react";

export function AuthCard({ title, subtitle, tab, children, footer }: { title: string; subtitle?: string; tab?: "login" | "host"; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="animate-fade-up overflow-hidden rounded-2xl bg-white shadow-lift">
      {tab && (
        <div className="grid grid-cols-2 border-b border-cream-200 text-center text-sm font-semibold">
          <Link href="/login" aria-current={tab === "login" ? "page" : undefined} className={`py-4 transition ${tab === "login" ? "border-b-2 border-gold-500 text-ink" : "text-muted hover:text-ink"}`}>
            Sign in
          </Link>
          <Link href="/host/register" aria-current={tab === "host" ? "page" : undefined} className={`py-4 transition ${tab === "host" ? "border-b-2 border-gold-500 text-ink" : "text-muted hover:text-ink"}`}>
            Become a Host
          </Link>
        </div>
      )}
      <div className="p-6 sm:p-8">
        <h1 className="heading-serif text-[26px]">{title}</h1>
        {subtitle && <p className="mt-1.5 mb-6 text-sm text-muted">{subtitle}</p>}
        {children}
      </div>
      {footer && <div className="border-t border-cream-200 bg-cream-50 px-6 py-4 text-center text-sm text-muted sm:px-8">{footer}</div>}
    </div>
  );
}
