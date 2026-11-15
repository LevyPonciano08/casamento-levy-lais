import { readdir, readFile } from 'node:fs/promises';
import { pool, transaction } from './db.js';

try {
  await transaction(async client => {
    await client.query("select pg_advisory_xact_lock(20261029)");
    await client.query('create table if not exists app_migrations (name text primary key, applied_at timestamptz not null default now())');
    for (const name of (await readdir(new URL('./migrations/', import.meta.url))).filter(n => n.endsWith('.sql')).sort()) {
      if ((await client.query('select 1 from app_migrations where name=$1', [name])).rowCount) continue;
      await client.query(await readFile(new URL(`./migrations/${name}`, import.meta.url), 'utf8'));
      await client.query('insert into app_migrations(name) values($1)', [name]);
      console.log(`Aplicada: ${name}`);
    }
  });
  console.log('PostgreSQL conectado; migrações concluídas.');
} catch (error) { console.error('Falha na migração:', error.code || error.message); process.exitCode = 1; }
finally { await pool.end(); }
