import type { Metadata } from "next";
import Link from "next/link";
import { forgotPasswordAction } from "@/actions/auth";
import { AuthCard } from "@/components/auth-card";
import { ActionForm, SubmitButton, TextField } from "@/components/forms";
import { Notice } from "@/components/ui";
import { emailConfigured } from "@/lib/email";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  // Reset links are emailed. Outside production the link is printed in the server log.
  const canReset = emailConfigured() || process.env.NODE_ENV !== "production";
  return (
    <AuthCard
      title="Forgot your password?"
      subtitle={
        canReset
          ? "Enter your email and we'll send you a link to choose a new one."
          : "Password reset by email is not available at the moment."
      }
      footer={
        <Link
          href="/login"
          className="font-semibold text-gold-700 hover:underline"
        >
          Back to sign in
        </Link>
      }
    >
      {!emailConfigured() && process.env.NODE_ENV !== "production" && (
        <div className="mb-5">
          <Notice tone="warning">
            Development mode: no email provider is configured, so the reset link
            is printed in the server log instead of being emailed.
          </Notice>
        </div>
      )}
      {!canReset && (
        <Notice tone="warning">
          Please{" "}
          <Link
            href="/contact"
            className="font-semibold underline underline-offset-2"
          >
            contact our support team
          </Link>{" "}
          and we will help you get back into your account.
        </Notice>
      )}
      {canReset && (
        <ActionForm
          action={forgotPasswordAction}
          className="space-y-4"
          resetOnSuccess
        >
          <TextField
            name="email"
            label="Email address"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
          />
          <SubmitButton
            className="btn btn-gold btn-lg w-full"
            pendingText="Sending…"
          >
            Send reset link
          </SubmitButton>
        </ActionForm>
      )}
    </AuthCard>
  );
}
