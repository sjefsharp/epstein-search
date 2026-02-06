import { Pool } from "pg";

let pool: Pool | null = null;

export const getDbPool = () => {
  if (pool) return pool;

  const connectionString = process.env.NEON_DATABASE_URL;
  if (!connectionString) {
    throw new Error("NEON_DATABASE_URL is not configured");
  }

  pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
  });

  return pool;
};

export const runQuery = async <T extends import("pg").QueryResultRow>(
  text: string,
  params: unknown[] = [],
) => {
  const db = getDbPool();
  const result = await db.query<T>(text, params);
  return result;
};
