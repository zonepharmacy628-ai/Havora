import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { loginAction } from "@/actions/auth";
import { AuthCard } from "@/components/auth-card";
import { ActionForm, SubmitButton, TextField } from "@/components/forms";
import { Notice } from "@/components/ui";
import { ADMIN_LOGIN_PATH, dashboardPathFor, getCurrentUser, isAdminArea, safeNextPath } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  const { next, reset } = await searchParams;
  if (isAdminArea(safeNextPath(next, ""))) redirect(`${ADMIN_LOGIN_PATH}?next=${encodeURIComponent(safeNextPath(next, "/admin"))}`);
  const user = await getCurrentUser();
  if (user) redirect(safeNextPath(next, dashboardPathFor(user.role)));
  const nextPath = safeNextPath(next, "");

  return (
    <AuthCard
      tab="login"
      title="Welcome back"
      subtitle="For hosts, administrators and existing account holders."
      footer={
        <>
          Want to list your property?{" "}
          <Link href="/host/register" className="font-semibold text-gold-700 hover:underline">
            Create a host account
          </Link>
        </>
      }
    >
      {reset === "1" && (
        <div className="mb-5">
          <Notice tone="success">Your password has been updated. Please sign in with your new password.</Notice>
        </div>
      )}
      <div className="mb-5">
        <Notice>
          Booking a stay? You don&apos;t need to sign in —{" "}
          <Link href="/properties" className="font-semibold underline underline-offset-2">
            browse properties
          </Link>{" "}
          or{" "}
          <Link href="/bookings" className="font-semibold underline underline-offset-2">
            find your booking
          </Link>
          .
        </Notice>
      </div>
      <ActionForm action={loginAction} className="space-y-4">
        <input type="hidden" name="next" value={nextPath} />
        <TextField name="email" label="Email address" type="email" autoComplete="email" placeholder="you@example.com" required />
        <TextField name="password" label="Password" type="password" autoComplete="current-password" placeholder="Enter your password" required />
        <div className="text-right">
          <Link href="/forgot-password" className="text-xs font-semibold text-gold-700 hover:underline">
            Forgot password?
          </Link>
        </div>
        <SubmitButton className="btn btn-gold btn-lg w-full" pendingText="Signing in…">
          Sign in
        </SubmitButton>
      </ActionForm>
    </AuthCard>
  );
}
