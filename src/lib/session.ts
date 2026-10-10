import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Role, UserStatus } from "@prisma/client";
import { auth } from "./auth";
import { prisma } from "./prisma";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  phone: string | null;
  country: string | null;
  bio: string | null;
  createdAt: Date;
};

/**
 * The signed-in user, re-read from the database on every request so role
 * changes and suspensions take effect immediately. Suspended users are treated
 * as signed out.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, status: true, phone: true, country: true, bio: true, createdAt: true },
  });
  if (!user || user.status !== "ACTIVE") return null;
  return user;
});

/** Where a signed-in user belongs. Only hosts and administrators have a dashboard. */
export function dashboardPathFor(role: Role): string {
  if (role === "ADMIN") return "/admin";
  if (role === "OWNER") return "/owner";
  return "/bookings";
}

/** Only allow same-site relative redirect targets. */
export function safeNextPath(next: unknown, fallback: string): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}

export const ADMIN_LOGIN_PATH = "/admin/login";

/** True for addresses inside the Admin Panel. */
export function isAdminArea(path: unknown): boolean {
  return typeof path === "string" && (path === "/admin" || path.startsWith("/admin/"));
}

/** Where the administrator sign-in sends people afterwards: always somewhere inside the Admin Panel. */
export function adminNextPath(next: unknown): string {
  const safe = safeNextPath(next, "/admin");
  return isAdminArea(safe) && safe !== ADMIN_LOGIN_PATH ? safe : "/admin";
}

/** For pages: redirects to sign-in when there is no active session. */
export async function requireUser(nextPath?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login");
  return user;
}

/** For pages: signed-in users without one of the roles are sent to their own dashboard. */
export async function requireRole(roles: Role[], nextPath?: string): Promise<SessionUser> {
  // Administrator-only pages send signed-out visitors to the administrator sign-in page.
  if (roles.length === 1 && roles[0] === "ADMIN" && !(await getCurrentUser())) {
    redirect(`${ADMIN_LOGIN_PATH}?next=${encodeURIComponent(adminNextPath(nextPath))}`);
  }
  const user = await requireUser(nextPath);
  if (!roles.includes(user.role)) redirect(dashboardPathFor(user.role));
  return user;
}

export class AuthorizationError extends Error {
  constructor(message = "You do not have permission to do that.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** For server actions: throws instead of redirecting. */
export async function assertUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError("Please sign in to continue.");
  return user;
}

export async function assertRole(roles: Role[]): Promise<SessionUser> {
  const user = await assertUser();
  if (!roles.includes(user.role)) throw new AuthorizationError();
  return user;
}
