import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import dns from "node:dns";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

type Database = NodePgDatabase<typeof schema>;

let poolInstance: pg.Pool | null = null;
let dbInstance: Database | null = null;

function resolveDatabaseUrl(): string | null {
  const rawUrl = process.env.SUPABASE_POOLER_URL ?? process.env.DATABASE_URL;
  return rawUrl ?? null;
}

function createSupabaseLookup(hostname: string) {
  return async (
    lookupHost: string,
    _options: dns.LookupOneOptions,
    callback: (error: NodeJS.ErrnoException | null, address?: string, family?: number) => void,
  ) => {
    try {
      if (hostname.endsWith(".supabase.co") && lookupHost === hostname) {
        const records = await dns.promises.resolve6(lookupHost);
        if (records[0]) {
          callback(null, records[0], 6);
          return;
        }
      }

      const records = await dns.promises.resolve4(lookupHost);
      if (records[0]) {
        callback(null, records[0], 4);
        return;
      }

      callback(new Error(`Unable to resolve ${lookupHost}`));
    } catch (error) {
      callback(error as NodeJS.ErrnoException);
    }
  };
}

function createPool(connectionString: string): pg.Pool {
  const { hostname } = new URL(connectionString);
  const isSupabaseHost =
    hostname.endsWith(".supabase.co") || hostname.endsWith(".pooler.supabase.com");

  return new Pool({
    connectionString,
    ...(hostname.endsWith(".supabase.co")
      ? {
          lookup: createSupabaseLookup(hostname),
        }
      : {}),
    ...(isSupabaseHost
      ? {
          ssl: {
            rejectUnauthorized: false,
          },
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

  if (!poolInstance) {
    poolInstance = createPool(connectionString);
  }

  if (!dbInstance) {
    dbInstance = drizzle(poolInstance, { schema });
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
    const instance = createDb() as Record<PropertyKey, unknown>;
    const value = instance[property];
    return typeof value === "function" ? value.bind(instance) : value;
  },
}) as Database;

export * from "./schema";
