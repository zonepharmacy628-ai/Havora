/**
 * Grants administrator rights to the account named in ADMIN_EMAIL.
 *
 * Runs automatically at the end of every Vercel build (after migrations), and
 * can be run by hand with `npm run admin:ensure`. It only promotes an account
 * that already exists and is active; it never creates accounts, never touches
 * passwords, and never fails the build.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { ensureAdmin } from "../src/lib/admin-bootstrap";

const MESSAGES: Record<string, string> = {
  "not-configured": "ADMIN_EMAIL is not set — no administrator was changed.",
  "invalid-email": "ADMIN_EMAIL is not a valid email address — no administrator was changed.",
  "no-account": "No account is registered with the ADMIN_EMAIL address yet. Register it on the site, then redeploy.",
  suspended: "The ADMIN_EMAIL account is suspended and was not promoted.",
  "already-admin": "The ADMIN_EMAIL account is already an administrator.",
  promoted: "The ADMIN_EMAIL account has been granted administrator rights.",
};

async function main() {
  const prisma = new PrismaClient();
  try {
    const outcome = await ensureAdmin(prisma, process.env.ADMIN_EMAIL);
    // The address itself is never printed, so it does not end up in build logs.
    console.log(`[admin] ${MESSAGES[outcome]}`);
  } catch (error) {
    console.warn("[admin] Could not check the administrator account:", error instanceof Error ? error.message.split("\n")[0] : "unknown error");
  } finally {
    await prisma.$disconnect();
  }
}

void main();
