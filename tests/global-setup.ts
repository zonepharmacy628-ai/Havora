import { exec } from "node:child_process";
import { promisify } from "node:util";
import { startLocalDb } from "../scripts/dev-db";

/**
 * Boots a throwaway in-memory PostgreSQL (PGlite) for the integration tests and
 * applies the real Prisma migrations to it, so tests exercise the same schema
 * and constraints as production. Nothing touches your development database.
 */
const PORT = Number(process.env.TEST_DB_PORT ?? 54331);
export const TEST_DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres?sslmode=disable&connection_limit=1&pgbouncer=true`;

export default async function setup() {
  const db = await startLocalDb({ port: PORT });
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.DIRECT_URL = TEST_DATABASE_URL;
  // Must be async: the database server lives in this process and has to keep answering.
  await promisify(exec)("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL, DIRECT_URL: TEST_DATABASE_URL },
  });
  return async () => {
    await db.stop();
  };
}
