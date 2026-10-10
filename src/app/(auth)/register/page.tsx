import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Search } from "lucide-react";
import { AuthCard } from "@/components/auth-card";

export const metadata: Metadata = { title: "No account needed" };

// Public customer registration has been removed: guests book without an account.
// The only public sign-up is the host registration at /host/register.
export default function RegisterPage() {
  return (
    <AuthCard
      title="You don't need an account to book"
      subtitle="Choose your dates, enter your details at checkout and you're done. You get a private link to manage your booking."
      footer={
        <>
          Have an existing account?{" "}
          <Link href="/login" className="font-semibold text-gold-700 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <div className="space-y-3">
        <Link href="/properties" className="flex items-center gap-4 rounded-xl border border-cream-300 p-4 transition hover:border-gold-500 hover:bg-gold-50">
          <Search className="size-6 shrink-0 text-gold-600" aria-hidden="true" />
          <span>
            <span className="block text-sm font-semibold text-ink">Find a place to stay</span>
            <span className="block text-xs text-muted">Browse properties and book as a guest</span>
          </span>
        </Link>
        <Link href="/host" className="flex items-center gap-4 rounded-xl border border-cream-300 p-4 transition hover:border-gold-500 hover:bg-gold-50">
          <Building2 className="size-6 shrink-0 text-gold-600" aria-hidden="true" />
          <span>
            <span className="block text-sm font-semibold text-ink">List your property</span>
            <span className="block text-xs text-muted">Create a host account and welcome guests</span>
          </span>
        </Link>
      </div>
    </AuthCard>
  );
}
