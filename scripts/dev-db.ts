/**
 * Local PostgreSQL for development — no Docker or system install needed.
 * Runs PGlite (PostgreSQL compiled to WebAssembly) behind a real Postgres wire
 * protocol socket, so Prisma connects to it like any other database.
 *
 *   npm run db:local        # keeps running until Ctrl+C; data in ./.data/pglite
 *
 * PGlite is a single-session engine: fine for local development, not for
 * production. Production uses a managed PostgreSQL provider (see README).
 */
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import fs from "node:fs";
import path from "node:path";

export async function startLocalDb(options: { port: number; dataDir?: string }) {
  if (options.dataDir) fs.mkdirSync(path.dirname(options.dataDir), { recursive: true });
  const db = await PGlite.create({ dataDir: options.dataDir, extensions: { btree_gist } });
  const server = new PGLiteSocketServer({ db, port: options.port, host: "127.0.0.1", maxConnections: 20 });
  await server.start();
  return {
    stop: async () => {
      await server.stop().catch(() => {});
      await db.close().catch(() => {});
    },
  };
}

const isDirectRun = process.argv[1]?.split(path.sep).join("/").endsWith("scripts/dev-db.ts");

if (isDirectRun) {
  const port = Number(process.env.LOCAL_DB_PORT ?? 54329);
  startLocalDb({ port, dataDir: path.resolve(process.cwd(), ".data", "pglite") })
    .then((local) => {
      console.log(`Local PostgreSQL (PGlite) ready on 127.0.0.1:${port}`);
      console.log("Press Ctrl+C to stop.");
      const stop = async () => {
        await local.stop();
        process.exit(0);
      };
      process.on("SIGINT", stop);
      process.on("SIGTERM", stop);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
