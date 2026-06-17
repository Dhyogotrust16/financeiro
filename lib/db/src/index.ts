import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

type Database = NodePgDatabase<typeof schema>;

let poolInstance: pg.Pool | null = null;
let dbInstance: Database | null = null;

function createDb(): Database {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }

  if (!poolInstance) {
    poolInstance = new Pool({ connectionString: process.env.DATABASE_URL });
  }

  if (!dbInstance) {
    dbInstance = drizzle(poolInstance, { schema });
  }

  return dbInstance;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getDb(): Database {
  return createDb();
}

export const db = new Proxy({} as Database, {
  get(_target, property) {
    const instance = createDb() as Record<PropertyKey, unknown>;
    const value = instance[property];
    return typeof value === "function" ? value.bind(instance) : value;
  },
}) as Database;

export * from "./schema";
