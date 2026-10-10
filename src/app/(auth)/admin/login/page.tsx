import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { adminLoginAction } from "@/actions/auth";
import { AuthCard } from "@/components/auth-card";
import { ActionForm, SubmitButton, TextField } from "@/components/forms";
import { Notice } from "@/components/ui";
import { adminNextPath, getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Administrator sign in", robots: { index: false, follow: false } };

// The Admin Panel is opened by typing its address. This page is not linked from
// the public site, and there is no administrator registration.
export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const nextPath = adminNextPath(next);
  const user = await getCurrentUser();
  if (user?.role === "ADMIN") redirect(nextPath);

  return (
    <AuthCard
      title="Administrator sign in"
      subtitle="Restricted area. Sign in with an administrator account to open the HAVORA Admin Panel."
      footer={
        <>
          Not an administrator?{" "}
          <Link href="/login" className="font-semibold text-gold-700 hover:underline">
            Host sign in
          </Link>
        </>
      }
    >
      {user && (
        <div className="mb-5">
          <Notice tone="warning">
            You are signed in as {user.email}, which is not an administrator account. Sign in below with an administrator account to continue.
          </Notice>
        </div>
      )}
      <ActionForm action={adminLoginAction} className="space-y-4">
        <input type="hidden" name="next" value={nextPath} />
        <TextField name="email" label="Email address" type="email" autoComplete="username" placeholder="you@example.com" required />
        <TextField name="password" label="Password" type="password" autoComplete="current-password" placeholder="Enter your password" required />
        <div className="text-right">
          <Link href="/forgot-password" className="text-xs font-semibold text-gold-700 hover:underline">
            Forgot password?
          </Link>
        </div>
        <SubmitButton className="btn btn-gold btn-lg w-full" pendingText="Signing in…">
          <ShieldCheck className="size-4" aria-hidden="true" /> Sign in to Admin Panel
        </SubmitButton>
      </ActionForm>
    </AuthCard>
  );
}
