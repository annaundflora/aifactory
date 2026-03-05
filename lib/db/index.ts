import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  // Convert Python asyncpg format to standard postgresql:// format
  return url.replace("postgresql+asyncpg://", "postgresql://");
}

// Singleton: module-level connection, reused across all imports
const connectionString = getDatabaseUrl();
const sql = postgres(connectionString);

export const db = drizzle(sql, { schema });
