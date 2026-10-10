import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { registerOwnerAction } from "@/actions/auth";
import { AuthCard } from "@/components/auth-card";
import { ActionForm, CheckboxField, SubmitButton, TextField } from "@/components/forms";
import { Notice } from "@/components/ui";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Create your host account" };

export default async function HostRegisterPage() {
  const user = await getCurrentUser();
  // Hosts and admins already have what this page creates.
  if (user?.role === "OWNER" || user?.role === "ADMIN") redirect("/owner");

  return (
    <AuthCard
      tab="host"
      title="Create your host account"
      subtitle="List and manage your properties on HAVORA."
      footer={
        <>
          Already a host?{" "}
          <Link href="/login?next=/owner" className="font-semibold text-gold-700 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      {user ? (
        <div className="mt-4 space-y-4">
          <Notice tone="warning">
            You are signed in as {user.email}. That account cannot be converted into a host account. To host, sign out and register with a different email address, or contact our support team.
          </Notice>
          <Link href="/contact" className="btn btn-gold w-full">
            Contact support
          </Link>
        </div>
      ) : (
        <ActionForm action={registerOwnerAction} className="space-y-4">
          {/* No role or account-type field: this route always creates a host account, decided on the server. */}
          <TextField name="name" label="Full name" autoComplete="name" placeholder="Jane Doe" required />
          <TextField name="email" label="Email address" type="email" autoComplete="email" placeholder="you@example.com" required />
          <TextField name="password" label="Password" type="password" autoComplete="new-password" placeholder="At least 10 characters" hint="Use at least 10 characters." required />
          <CheckboxField
            name="terms"
            label={
              <>
                I agree to the{" "}
                <Link href="/terms" target="_blank" className="font-semibold text-gold-700 hover:underline">
                  Terms &amp; Conditions
                </Link>{" "}
                and{" "}
                <Link href="/privacy" target="_blank" className="font-semibold text-gold-700 hover:underline">
                  Privacy Policy
                </Link>
                .
              </>
            }
          />
          <SubmitButton className="btn btn-gold btn-lg w-full" pendingText="Creating account…">
            Create host account
          </SubmitButton>
          <p className="text-center text-xs text-muted">Just want to book a stay? You don&apos;t need an account.</p>
        </ActionForm>
      )}
    </AuthCard>
  );
}
