import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { pool, transaction } from './db.js';

const sourceUrl = process.env.SUPABASE_URL || 'https://pszrshbwqxeefhoxfkyk.supabase.co';
const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_DemlV9A14gxg2KUOqNK0Hg_G8A1jo1-';
let source;
try {
  const data = {};
  const tables = ['gifts','gift_orders','payment_events','rsvp_responses','admin_audit_log'];
  const management = Boolean(process.env.SUPABASE_ACCESS_TOKEN && process.env.SUPABASE_PROJECT_REF);
  const full = Boolean(process.env.SUPABASE_DATABASE_URL) || management;
  if (management) {
    const snapshotQuery = `select json_build_object(${tables.map(table => `'${table}',(select coalesce(json_agg(t),'[]'::json) from public.${table} t)`).join(',')}) as snapshot`;
    const response = await fetch(`https://api.supabase.com/v1/projects/${encodeURIComponent(process.env.SUPABASE_PROJECT_REF)}/database/query`, {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: snapshotQuery, read_only: true }), signal: AbortSignal.timeout(60000)
    });
    if (!response.ok) throw new Error(`Supabase Management API indisponível: HTTP ${response.status}`);
    const result = await response.json();
    if (!Array.isArray(result) || !result[0]?.snapshot) throw new Error('Snapshot do Supabase inválido.');
    Object.assign(data, result[0].snapshot);
  } else if (full) {
    source = new pg.Client({ connectionString: process.env.SUPABASE_DATABASE_URL });
    await source.connect();
    await source.query('begin isolation level repeatable read read only');
    for (const table of tables) data[table] = (await source.query(`select * from public.${table}`)).rows;
    await source.query('commit');
  } else {
    const rows = [];
    for (let start = 0; ; start += 500) {
      const response = await fetch(`${sourceUrl}/rest/v1/gift_catalog?select=*&order=id&offset=${start}&limit=500`, { headers: { apikey: publicKey }, signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error('Não foi possível ler o catálogo público.');
      const page = await response.json();
      rows.push(...page);
      if (page.length < 500) break;
    }
    data.gifts = rows.map(row => ({ ...row, is_active: true }));
  }
  if (full && process.env.IMPORT_BACKUP_PATH) await writeFile(process.env.IMPORT_BACKUP_PATH, JSON.stringify(data, null, 2), { mode: 0o600 });
  const images = [];
  for (const gift of data.gifts) {
    gift.created_by = null; // New administrators are created locally; old auth IDs are not reused.
    if (!gift.image_path) continue;
    const sourcePath = gift.image_path;
    const existing = (await pool.query('select path from gift_images where source_path=$1', [sourcePath])).rows[0];
    if (existing) { gift.image_path = existing.path; continue; }
    const response = await fetch(`${sourceUrl}/storage/v1/object/public/gift-images/${sourcePath.split('/').map(encodeURIComponent).join('/')}`, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error('Não foi possível importar uma imagem. Nenhum dado desta importação foi gravado.');
    const content = Buffer.from(await response.arrayBuffer());
    const type = response.headers.get('content-type')?.split(';')[0];
    if (!['image/jpeg','image/png','image/webp'].includes(type) || content.length > 5242880) throw new Error('Imagem fora do formato ou tamanho permitido.');
    const id = randomUUID();
    images.push([id,type,content,sourcePath]);
    gift.image_path = id;
  }
  const counts = {};
  const sourceApprovedTotal = full ? data.gift_orders.filter(order => order.status === 'approved').reduce((sum, order) => sum + Number(order.amount_cents), 0) : null;
  await transaction(async client => {
    // Do not overwrite a live destination with a stale source snapshot.
    await client.query("select pg_advisory_xact_lock(20261030)");
    const { rowCount: previousFull } = await client.query("select 1 from migration_imports where scope='full' limit 1");
    if (previousFull) throw new Error('Importação completa já realizada; preserve as alterações feitas no Neon.');
    const { rows: [{ count }] } = await client.query('select count(*)::int as count from gift_orders');
    if (count) throw new Error('O destino já tem pedidos. Faça a conciliação antes de importar novamente.');
    for (const image of images) await client.query('insert into gift_images(path,content_type,content,source_path) values($1,$2,$3,$4)', image);
    for (const table of tables) {
      if (!data[table]) continue;
      const allowed = (await client.query("select column_name from information_schema.columns where table_schema='public' and table_name=$1 and is_generated='NEVER'", [table])).rows.map(r => r.column_name);
      for (const row of data[table]) {
        if (table === 'admin_audit_log') row.admin_user_id = null;
        const keys = allowed.filter(k => Object.hasOwn(row,k));
        const values = keys.map(k => row[k] && typeof row[k] === 'object' && !(row[k] instanceof Date) ? JSON.stringify(row[k]) : row[k]);
        await client.query(`insert into ${table}(${keys.join(',')}) values(${keys.map((_,i)=>`$${i+1}`).join(',')}) on conflict(id) do update set ${keys.filter(k=>k!=='id').map(k=>`${k}=excluded.${k}`).join(',')}`, values);
      }
      counts[table] = data[table].length;
      const keyType = ['payment_events','admin_audit_log'].includes(table) ? 'bigint' : 'uuid';
      const { rows: [{ total }] } = await client.query(`select count(*)::int as total from ${table} where id=any($1::${keyType}[])`, [data[table].map(row => row.id)]);
      if (total !== data[table].length) throw new Error(`Conferência de quantidade falhou: ${table}`);
    }
    for (const table of ['payment_events','admin_audit_log']) {
      if (full) await client.query(`select setval(pg_get_serial_sequence('${table}','id'),coalesce((select max(id) from ${table}),1),exists(select 1 from ${table}))`);
    }
    if (full) {
      const { rows: [{ total }] } = await client.query("select coalesce(sum(amount_cents),0)::text as total from gift_orders where status='approved'");
      if (Number(total) !== sourceApprovedTotal) throw new Error('Divergência no total de pagamentos aprovados; importação cancelada.');
    }
    await client.query('insert into migration_imports(scope,counts) values($1,$2)', [full ? 'full' : 'public', JSON.stringify(counts)]);
  });
  console.log(`Importação ${full ? 'completa' : 'do catálogo público'} concluída:`, counts, `Imagens copiadas: ${images.length}`);
  if (full) {
    console.log(`Conferência: pagamentos aprovados = ${sourceApprovedTotal} centavos no banco de origem e no Neon.`);
  }
  if (!full) console.log('Pedidos e presenças ainda precisam da conexão privada SUPABASE_DATABASE_URL. Pagamentos devem continuar desativados.');
} catch (error) { console.error('Importação interrompida:', error.code || error.message); process.exitCode = 1; }
finally { if (source) await source.end(); await pool.end(); }
