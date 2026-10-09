import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, Luggage } from "lucide-react";
import { registerAction } from "@/actions/auth";
import { AuthCard } from "@/components/auth-card";
import { ActionForm, CheckboxField, SubmitButton, TextField } from "@/components/forms";
import { dashboardPathFor, getCurrentUser, safeNextPath } from "@/lib/session";

export const metadata: Metadata = { title: "Create your account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string; type?: string }> }) {
  const { next, type } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(dashboardPathFor(user.role));
  const nextPath = safeNextPath(next, "");
  const asOwner = type === "owner";

  const types = [
    { value: "CUSTOMER", icon: Luggage, title: "I want to book stays", text: "Search, reserve and review" },
    { value: "OWNER", icon: Building2, title: "I want to host", text: "List and manage properties" },
  ];

  return (
    <AuthCard
      tab="register"
      title="Create your account"
      subtitle="Join HAVORA to book extraordinary stays or host your own."
      footer={
        <>
          Already have an account?{" "}
          <Link href={nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login"} className="font-semibold text-gold-700 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <ActionForm action={registerAction} className="space-y-4">
        <input type="hidden" name="next" value={asOwner ? "" : nextPath} />
        <fieldset>
          <legend className="label">Account type</legend>
          <div className="grid grid-cols-2 gap-3">
            {types.map(({ value, icon: Icon, title, text }) => (
              <label key={value} className="cursor-pointer rounded-xl border border-cream-300 p-3 transition has-checked:border-gold-500 has-checked:bg-gold-50 has-checked:ring-1 has-checked:ring-gold-500">
                <input type="radio" name="accountType" value={value} defaultChecked={asOwner ? value === "OWNER" : value === "CUSTOMER"} className="sr-only" />
                <Icon className="mb-1.5 size-5 text-gold-600" aria-hidden="true" />
                <span className="block text-[13px] font-semibold text-ink">{title}</span>
                <span className="block text-xs text-muted">{text}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <TextField name="name" label="Full name" autoComplete="name" placeholder="Jane Doe" required />
        <TextField name="email" label="Email address" type="email" autoComplete="email" placeholder="you@example.com" required />
        <TextField name="password" label="Password" type="password" autoComplete="new-password" placeholder="At least 10 characters" hint="Use at least 10 characters." required />
        <CheckboxField
          name="terms"
          label={
            <>
                I agree to the{" "}
                <Link href="/terms" target="_blank" className="font-semibold text-gold-700 hover:underline">Terms &amp; Conditions</Link> and{" "}
                <Link href="/privacy" target="_blank" className="font-semibold text-gold-700 hover:underline">Privacy Policy</Link>.
            </>
          }
        />
        <SubmitButton className="btn btn-gold btn-lg w-full" pendingText="Creating account…">
          Create account
        </SubmitButton>
      </ActionForm>
    </AuthCard>
  );
}
