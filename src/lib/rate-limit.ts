import "server-only";
import { headers } from "next/headers";
import { prisma } from "./prisma";

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/**
 * Database-backed fixed-window rate limiter (works across serverless instances).
 * Returns true when the request is allowed.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimitBucket" ("key", "count", "windowStart")
    VALUES (${key}, 1, NOW())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitBucket"."windowStart" < NOW() - make_interval(secs => ${windowSeconds}::int) THEN 1
        ELSE "RateLimitBucket"."count" + 1
      END,
      "windowStart" = CASE
        WHEN "RateLimitBucket"."windowStart" < NOW() - make_interval(secs => ${windowSeconds}::int) THEN NOW()
        ELSE "RateLimitBucket"."windowStart"
      END
    RETURNING "count"`;
  return (rows[0]?.count ?? 1) <= limit;
}

/** Convenience: limit an action per client IP. */
export async function rateLimitByIp(action: string, limit: number, windowSeconds: number): Promise<boolean> {
  return rateLimit(`${action}:${await clientIp()}`, limit, windowSeconds);
}
