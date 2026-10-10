"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { emailConfigured } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { rateLimit, rateLimitByIp } from "@/lib/rate-limit";
import { safely, TOO_MANY } from "@/lib/action-utils";
import { adminNextPath, assertUser, dashboardPathFor, isAdminArea, safeNextPath } from "@/lib/session";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  formToObject,
  invalid,
  loginSchema,
  profileSchema,
  ownerRegisterSchema,
  resetPasswordSchema,
  type FormState,
} from "@/lib/validation";

const apiErrorMessage = (error: unknown): string | null => {
  const body = (error as { body?: { message?: string; code?: string } })?.body;
  return body?.message ?? null;
};

const apiErrorCode = (error: unknown): string | null =>
  (error as { body?: { code?: string } })?.body?.code ?? null;

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return safely(async () => {
    const parsed = loginSchema.safeParse(formToObject(formData));
    if (!parsed.success) return invalid(parsed.error);
    const { email, password } = parsed.data;

    // Throttle by IP and by targeted account to slow down credential stuffing.
    if (!(await rateLimitByIp("login", 10, 600)) || !(await rateLimit(`login-email:${email}`, 8, 600))) return TOO_MANY;

    try {
      await auth.api.signInEmail({ body: { email, password }, headers: await headers() });
    } catch {
      return { ok: false, message: "Incorrect email or password." };
    }

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true, status: true } });
    if (!user || user.status !== "ACTIVE") {
      if (user) await prisma.session.deleteMany({ where: { userId: user.id } });
      return { ok: false, message: "This account has been suspended. Please contact support." };
    }
    // The ordinary sign-in never drops a non-administrator at an Admin Panel address.
    const target = safeNextPath(formData.get("next"), dashboardPathFor(user.role));
    redirect(isAdminArea(target) && user.role !== "ADMIN" ? dashboardPathFor(user.role) : target);
  });
}

const ADMIN_LOGIN_FAILED = "Those details are not valid for an administrator account.";

/**
 * Administrator sign-in (/admin/login). Only accounts that already hold the
 * administrator role can sign in here. The role is checked before any session
 * is created, and the same message is returned for an unknown email, a wrong
 * password and a non-administrator account, so nothing about accounts leaks.
 */
export async function adminLoginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return safely(async () => {
    const parsed = loginSchema.safeParse(formToObject(formData));
    if (!parsed.success) return invalid(parsed.error);
    const { email, password } = parsed.data;

    if (!(await rateLimitByIp("admin-login", 8, 900)) || !(await rateLimit(`admin-login-email:${email}`, 6, 900))) return TOO_MANY;

    const account = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true, status: true } });
    if (!account || account.role !== "ADMIN" || account.status !== "ACTIVE") {
      await audit({ actorId: account?.id ?? null, action: "admin.login_refused", entityType: "User", entityId: account?.id ?? null, metadata: { reason: !account ? "unknown email" : account.role !== "ADMIN" ? "not an administrator" : "suspended" } });
      return { ok: false, message: ADMIN_LOGIN_FAILED };
    }

    try {
      await auth.api.signInEmail({ body: { email, password }, headers: await headers() });
    } catch {
      await audit({ actorId: account.id, action: "admin.login_refused", entityType: "User", entityId: account.id, metadata: { reason: "wrong password" } });
      return { ok: false, message: ADMIN_LOGIN_FAILED };
    }

    await audit({ actorId: account.id, action: "admin.login", entityType: "User", entityId: account.id });
    redirect(adminNextPath(formData.get("next")));
  });
}

/**
 * Host registration (/host/register). This is the only public sign-up, and it
 * always creates a property-owner account: the role is fixed here on the server
 * and is never read from the request. Existing accounts are never upgraded.
 */
export async function registerOwnerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return safely(async () => {
    const parsed = ownerRegisterSchema.safeParse(formToObject(formData));
    if (!parsed.success) return invalid(parsed.error);
    const { name, email, password } = parsed.data;

    if (!(await rateLimitByIp("register", 5, 3600))) return TOO_MANY;

    let userId: string;
    try {
      const result = await auth.api.signUpEmail({ body: { name, email, password }, headers: await headers() });
      userId = result.user.id;
    } catch (error) {
      if (apiErrorCode(error)?.includes("USER_ALREADY_EXISTS")) {
        return {
          ok: false,
          message:
            "An account with this email address already exists, so a new host account cannot be created with it. Please sign in if you are already a host, or contact our support team to host with this email.",
          errors: { email: "This email address is already registered." },
        };
      }
      return { ok: false, message: apiErrorMessage(error) ?? "We could not create your account. Please try again." };
    }

    await prisma.user.update({ where: { id: userId }, data: { role: "OWNER" } });
    await audit({ actorId: userId, action: "user.registered", entityType: "User", entityId: userId, metadata: { role: "OWNER" } });

    redirect("/owner?welcome=1");
  });
}

export async function logoutAction(): Promise<void> {
  await auth.api.signOut({ headers: await headers() }).catch(() => null);
  redirect("/");
}

export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return safely(async () => {
    const parsed = forgotPasswordSchema.safeParse(formToObject(formData));
    if (!parsed.success) return invalid(parsed.error);
    if (!emailConfigured() && process.env.NODE_ENV === "production") {
      return { ok: false, message: "Password reset by email is not available at the moment. Please contact our support team." };
    }
    if (!(await rateLimitByIp("forgot", 5, 3600))) return TOO_MANY;

    await auth.api
      .requestPasswordReset({ body: { email: parsed.data.email, redirectTo: "/reset-password" }, headers: await headers() })
      .catch((error) => console.error("[auth] password reset request failed", error));

    // Same response whether or not the account exists, to avoid leaking which emails are registered.
    return { ok: true, message: "If an account exists for that email, a password reset link is on its way." };
  });
}

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return safely(async () => {
    const parsed = resetPasswordSchema.safeParse(formToObject(formData));
    if (!parsed.success) return invalid(parsed.error);
    if (!(await rateLimitByIp("reset", 10, 3600))) return TOO_MANY;

    try {
      await auth.api.resetPassword({ body: { newPassword: parsed.data.password, token: parsed.data.token } });
    } catch {
      return { ok: false, message: "This reset link is invalid or has expired. Please request a new one." };
    }
    redirect("/login?reset=1");
  });
}

export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return safely(async () => {
    const user = await assertUser();
    const parsed = profileSchema.safeParse(formToObject(formData));
    if (!parsed.success) return invalid(parsed.error);
    const { name, phone, country, bio } = parsed.data;
    await prisma.user.update({
      where: { id: user.id },
      data: { name, phone: phone ?? null, country: country ?? null, bio: bio ?? null },
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "Your profile has been updated." };
  });
}

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return safely(async () => {
    const user = await assertUser();
    const parsed = changePasswordSchema.safeParse(formToObject(formData));
    if (!parsed.success) return invalid(parsed.error);
    if (!(await rateLimit(`change-password:${user.id}`, 5, 900))) return TOO_MANY;

    try {
      await auth.api.changePassword({
        body: { currentPassword: parsed.data.currentPassword, newPassword: parsed.data.newPassword, revokeOtherSessions: true },
        headers: await headers(),
      });
    } catch {
      return { ok: false, message: "Please correct the highlighted fields.", errors: { currentPassword: "Your current password is incorrect." } };
    }
    await audit({ actorId: user.id, action: "user.password_changed", entityType: "User", entityId: user.id });
    return { ok: true, message: "Your password has been changed. Other devices have been signed out." };
  });
}
