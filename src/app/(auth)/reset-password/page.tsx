import type { Metadata } from "next";
import Link from "next/link";
import { resetPasswordAction } from "@/actions/auth";
import { AuthCard } from "@/components/auth-card";
import { ActionForm, SubmitButton, TextField } from "@/components/forms";
import { Notice } from "@/components/ui";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  const invalid = !token || Boolean(error);

  return (
    <AuthCard
      title="Choose a new password"
      subtitle={invalid ? undefined : "Your new password must be at least 10 characters."}
      footer={
        <Link href="/login" className="font-semibold text-gold-700 hover:underline">
          Back to sign in
        </Link>
      }
    >
      {invalid ? (
        <div className="mt-4 space-y-4">
          <Notice tone="warning">This password reset link is invalid or has expired.</Notice>
          <Link href="/forgot-password" className="btn btn-gold w-full">
            Request a new link
          </Link>
        </div>
      ) : (
        <ActionForm action={resetPasswordAction} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <TextField name="password" label="New password" type="password" autoComplete="new-password" placeholder="At least 10 characters" required />
          <SubmitButton className="btn btn-gold btn-lg w-full" pendingText="Saving…">
            Update password
          </SubmitButton>
        </ActionForm>
      )}
    </AuthCard>
  );
}
