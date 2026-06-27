import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

function connect(connectionString: string) {
  const client = postgres(connectionString, {
    // Neon's pooled endpoint runs PgBouncer in transaction mode, which does not
    // support prepared statements — disabling them is required there and is
    // harmless against a plain local Postgres.
    prepare: false,
    // Serverless invocations are short-lived and numerous; keep each instance's
    // pool tiny and let Neon's pooler handle the real multiplexing.
    max: 1,
  });
  return { client, db: drizzle(client, { schema }) };
}

type Connection = ReturnType<typeof connect>;
type Db = Connection["db"];

let connection: Connection | undefined;

function init(): Connection {
  if (!connection) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    connection = connect(connectionString);
  }
  return connection;
}

// `db` is importable eagerly but connects lazily on first use: `next build`
// evaluates route modules (which pull this file into the graph), and that must
// not require DATABASE_URL or open a socket until an actual query runs. Methods
// are bound to the real Drizzle instance so its internals work through the proxy.
export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    const real = init().db as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export const closeDb = () => connection?.client.end();
