import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import * as schema from "./schema";

type Database = PostgresJsDatabase<typeof schema>;

let clientInstance: Sql | null = null;
let dbInstance: Database | null = null;

function resolveDatabaseUrl(): string | null {
  const rawUrl = process.env.SUPABASE_POOLER_URL ?? process.env.DATABASE_URL;
  return rawUrl ?? null;
}

function createClient(connectionString: string): Sql {
  const { hostname } = new URL(connectionString);
  const isSupabaseHost =
    hostname.endsWith(".supabase.co") || hostname.endsWith(".pooler.supabase.com");

  return postgres(connectionString, {
    max: 1,
    prepare: false,
    ...(isSupabaseHost
      ? {
          ssl: "require",
        }
      : {}),
  });
}

function createDb(): Database {
  const connectionString = resolveDatabaseUrl();

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }

  if (!clientInstance) {
    clientInstance = createClient(connectionString);
  }

  if (!dbInstance) {
    dbInstance = drizzle({ client: clientInstance, schema });
  }

  return dbInstance;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(resolveDatabaseUrl());
}

export function getDb(): Database {
  return createDb();
}

export const db = new Proxy({} as Database, {
  get(_target, property) {
    const instance = createDb() as unknown as Record<PropertyKey, unknown>;
    const value = instance[property];
    return typeof value === "function" ? value.bind(instance) : value;
  },
}) as Database;

export * from "./schema";
