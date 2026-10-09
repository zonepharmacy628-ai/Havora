"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { rateLimit, rateLimitByIp } from "@/lib/rate-limit";
import { safely, TOO_MANY } from "@/lib/action-utils";
import { assertUser, dashboardPathFor, safeNextPath } from "@/lib/session";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  formToObject,
  invalid,
  loginSchema,
  profileSchema,
  registerSchema,
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
    redirect(safeNextPath(formData.get("next"), dashboardPathFor(user.role)));
  });
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  return safely(async () => {
    const parsed = registerSchema.safeParse(formToObject(formData));
    if (!parsed.success) return invalid(parsed.error);
    const { name, email, password, accountType } = parsed.data;

    if (!(await rateLimitByIp("register", 5, 3600))) return TOO_MANY;

    let userId: string;
    try {
      const result = await auth.api.signUpEmail({ body: { name, email, password }, headers: await headers() });
      userId = result.user.id;
    } catch (error) {
      if (apiErrorCode(error)?.includes("USER_ALREADY_EXISTS")) {
        return { ok: false, message: "Please correct the highlighted fields.", errors: { email: "An account with this email already exists." } };
      }
      return { ok: false, message: apiErrorMessage(error) ?? "We could not create your account. Please try again." };
    }

    // The role is never accepted from the sign-up request itself. Only CUSTOMER or
    // OWNER can be self-selected here; ADMIN can only be granted by an administrator.
    if (accountType === "OWNER") {
      await prisma.user.update({ where: { id: userId }, data: { role: "OWNER" } });
    }
    await audit({ actorId: userId, action: "user.registered", entityType: "User", entityId: userId, metadata: { role: accountType } });

    redirect(safeNextPath(formData.get("next"), dashboardPathFor(accountType)));
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
