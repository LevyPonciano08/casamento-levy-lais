import pg from 'pg';
import { attachDatabasePool } from '@vercel/functions';

if (!process.env.DATABASE_URL) throw new Error('Configure DATABASE_URL no .env');
const url = new URL(process.env.DATABASE_URL);
if (url.searchParams.has('sslmode')) url.searchParams.set('sslmode', 'verify-full');
export const pool = new pg.Pool({ connectionString: url.toString(), max: 5, connectionTimeoutMillis: 15000 });
if (process.env.VERCEL) attachDatabasePool(pool);
pool.on('error', error => console.error('PostgreSQL connection error:', error.code || error.name));
export async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
