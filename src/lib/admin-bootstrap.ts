import type { PrismaClient } from "@prisma/client";

// Grants administrator rights to the single account named by the ADMIN_EMAIL
// environment variable. There is deliberately no public way to become an
// administrator: this runs on the server during deployment (see
// scripts/ensure-admin.ts) and only ever promotes an account that already
// exists — it never creates accounts and never sets or changes a password.

export type EnsureAdminOutcome =
  | "not-configured" // ADMIN_EMAIL is empty
  | "invalid-email"
  | "no-account" // nobody has registered with that email yet
  | "suspended" // suspended accounts are never promoted
  | "already-admin"
  | "promoted";

export function normaliseAdminEmail(value: string | undefined | null): string | null {
  const email = (value ?? "").trim().toLowerCase();
  if (!email) return null;
  return /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(email) && email.length <= 254 ? email : "";
}

export async function ensureAdmin(prisma: PrismaClient, rawEmail: string | undefined | null): Promise<EnsureAdminOutcome> {
  const email = normaliseAdminEmail(rawEmail);
  if (email === null) return "not-configured";
  if (email === "") return "invalid-email";

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true, status: true } });
  if (!user) return "no-account";
  if (user.status !== "ACTIVE") return "suspended";
  if (user.role === "ADMIN") return "already-admin";

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } }),
    prisma.auditLog.create({
      data: {
        actorId: null,
        action: "user.promoted_to_admin",
        entityType: "User",
        entityId: user.id,
        metadata: { email, from: user.role, source: "ADMIN_EMAIL deployment setting" },
      },
    }),
  ]);
  return "promoted";
}
