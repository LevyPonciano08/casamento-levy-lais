import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, transaction } from './db.js';
import { requireAdmin, verifyPassword, hashPassword, createSession, cookieOptions, hashToken, sessionToken } from './auth.js';
import { checkout, webhook, verifyHuman, uuidPattern } from './payments.js';
import { publicFiles } from './public-files.js';
import { infiniteCheckout, infiniteWebhook, infiniteReturn } from './infinitepay.js';

const dummyPasswordHash = hashPassword('sem-conta');
export const app = express();
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY));
// As páginas não têm scripts nem estilos embutidos; só Cloudflare Turnstile, Google Maps e Google Fonts vêm de fora.
const contentSecurityPolicy = {
  useDefaults: false,
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", 'https://challenges.cloudflare.com'],
    styleSrc: ["'self'", 'https://fonts.googleapis.com'],
    styleSrcAttr: ["'unsafe-inline'"],
    fontSrc: ["'self'", 'https://fonts.gstatic.com'],
    imgSrc: ["'self'", 'data:', 'blob:'],
    connectSrc: ["'self'", 'https://challenges.cloudflare.com'],
    frameSrc: ['https://challenges.cloudflare.com', 'https://www.google.com'],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'self'"],
    ...(process.env.NODE_ENV === 'production' ? { upgradeInsecureRequests: [] } : {})
  }
};
app.use(helmet({ contentSecurityPolicy, crossOriginEmbedderPolicy: false }));
app.use((req, res, next) => {
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  next();
});
app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: 300 }));
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  const origin = req.get('origin');
  const allowed = (process.env.ALLOWED_ORIGINS || process.env.SITE_URL || 'http://localhost:3000').split(',').map(v => v.trim());
  if (origin && !allowed.includes(origin)) return res.status(403).json({ error: 'origin_not_allowed' });
  // Admin cookies require the API and website on the same origin.
  if (req.method !== 'GET' && req.get('sec-fetch-site') === 'cross-site') return res.status(403).json({ error: 'origin_not_allowed' });
  next();
});
app.use(express.json({ limit: '32kb' }));
app.get('/api/health', async (req, res) => { await pool.query('select 1'); res.json({ database: 'connected' }); });
app.get('/api/gifts', async (req, res) => {
  const { rows } = await pool.query('select * from gift_catalog order by sort_order,title');
  res.json(rows);
});
app.get('/api/images/:id', async (req, res) => {
  if (!uuidPattern.test(req.params.id)) return res.sendStatus(404);
  const { rows: [image] } = await pool.query('select content_type,content from gift_images where path=$1', [req.params.id]);
  if (!image) return res.sendStatus(404);
  res.set({ 'Content-Type': image.content_type, 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' }).send(image.content);
});
app.post('/api/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10 }), async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' || password.length > 512) return res.status(400).json({ error: 'invalid_request' });
  const { rows: [user] } = await pool.query('select * from admin_accounts where email=$1', [email.trim().toLowerCase()]);
  // Sem conta, ainda calcula um hash: o tempo de resposta não revela se o e-mail existe.
  if (!verifyPassword(password, user?.password_hash || dummyPasswordHash) || !user) return res.status(401).json({ error: 'invalid_credentials' });
  const token = await createSession(user.id);
  res.cookie('wedding_session', token, { ...cookieOptions, maxAge: 8 * 60 * 60 * 1000 });
  res.json({ id: user.id, email: user.email });
});
app.get('/api/session', requireAdmin, (req, res) => res.json(req.user));
app.post('/api/logout', async (req, res) => {
  await pool.query('delete from admin_sessions where token_hash=$1', [hashToken(sessionToken(req))]);
  res.clearCookie('wedding_session', cookieOptions).json({ ok: true });
});
app.get('/api/admin/dashboard', requireAdmin, async (req, res) => {
  const [gifts, orders, rsvps] = await Promise.all([
    pool.query('select * from gifts where archived_at is null order by sort_order,created_at'),
    pool.query("select o.*,json_build_object('title',g.title) as gifts from gift_orders o join gifts g on g.id=o.gift_id order by o.created_at desc"),
    pool.query('select id,guest_name,attending,companions,guest_message,created_at from rsvp_responses order by created_at desc')
  ]);
  res.json({ gifts: gifts.rows, orders: orders.rows, rsvps: rsvps.rows });
});
const fields = ['title','category','description','gift_mode','price_cents','minimum_contribution_cents','quantity_total','unlimited_purchases','sort_order','image_path','is_active'];
app.post('/api/admin/gifts', requireAdmin, saveGift);
app.patch('/api/admin/gifts/:id', requireAdmin, saveGift);
async function saveGift(req, res) {
  const input = req.body || {};
  if (req.params.id && !uuidPattern.test(req.params.id)) return res.status(400).json({ error: 'invalid_request' });
  const keys = fields.filter(k => Object.hasOwn(input, k));
  if (!keys.length) return res.status(400).json({ error: 'invalid_request' });
  if (input.image_path != null && !uuidPattern.test(input.image_path)) return res.status(400).json({ error: 'invalid_image' });
  const values = keys.map(k => input[k]);
  const gift = await transaction(async client => {
    let result;
    if (req.params.id) result = await client.query(`update gifts set ${keys.map((k,i) => `${k}=$${i+1}`).join(',')} where id=$${keys.length+1} returning *`, [...values, req.params.id]);
    else result = await client.query(`insert into gifts(${keys.join(',')},created_by) values(${keys.map((_,i) => `$${i+1}`).join(',')},$${keys.length+1}) returning *`, [...values, req.user.id]);
    if (result.rows[0]) await client.query("insert into admin_audit_log(admin_user_id,action,entity_type,entity_id) values($1,$2,'gift',$3)", [req.user.id, req.params.id ? 'update' : 'insert', result.rows[0].id]);
    return result.rows[0];
  });
  if (!gift) return res.sendStatus(404);
  res.json(gift);
}
app.delete('/api/admin/gifts/:id', requireAdmin, async (req, res) => {
  const id = req.params.id;
  if (!uuidPattern.test(id)) return res.status(400).json({ error: 'invalid_request' });
  await transaction(async client => {
    // Lock the gift so a simultaneous checkout cannot race deletion.
    await client.query('select id from gifts where id=$1 for update', [id]);
    const { rowCount } = await client.query('select 1 from gift_orders where gift_id=$1 limit 1', [id]);
    if (rowCount) await client.query('update gifts set is_active=false,archived_at=now() where id=$1', [id]);
    else await client.query('delete from gifts where id=$1', [id]);
    await client.query("insert into admin_audit_log(admin_user_id,action,entity_type,entity_id) values($1,'delete','gift',$2)", [req.user.id, id]);
  });
  res.json({ ok: true });
});
app.post('/api/admin/images', requireAdmin, express.raw({ type: ['image/jpeg','image/png','image/webp'], limit: '4mb' }), async (req, res) => {
  const content = req.body;
  const type = req.get('content-type')?.split(';')[0];
  const valid = Buffer.isBuffer(content) && (
    (type === 'image/jpeg' && content.subarray(0,3).equals(Buffer.from([255,216,255]))) ||
    (type === 'image/png' && content.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) ||
    (type === 'image/webp' && content.subarray(0,4).toString() === 'RIFF' && content.subarray(8,12).toString() === 'WEBP')
  );
  if (!valid) return res.status(400).json({ error: 'invalid_image' });
  const id = randomUUID();
  await pool.query('insert into gift_images(path,content_type,content) values($1,$2,$3)', [id,type,content]);
  res.json({ path: id });
});
const publicLimit = rateLimit({ windowMs: 60 * 1000, limit: 15 });
app.post('/api/create-checkout', publicLimit, (req, res, next) => {
  const handler = process.env.PAYMENT_PROVIDER === 'mercado_pago' ? checkout : infiniteCheckout;
  Promise.resolve(handler(req, res)).catch(next);
});
app.post('/api/infinitepay-webhook', rateLimit({ windowMs: 60000, limit: 120 }), infiniteWebhook);
app.post('/api/check-payment', publicLimit, infiniteReturn);
app.post('/api/mercado-pago-webhook', webhook);
app.post('/api/submit-rsvp', publicLimit, async (req, res) => {
  const input = req.body || {};
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const message = typeof input.message === 'string' ? input.message.trim() : '';
  const companions = input.companions ?? [];
  if (!Array.isArray(companions) || companions.length > 20 || companions.some(name => typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 120) ||
      (input.attending === false && companions.length)) return res.status(400).json({ error: 'invalid_request' });
  if (!uuidPattern.test(input.submissionKey) || name.length < 2 || name.length > 120 || typeof input.attending !== 'boolean' || message.length > 300) return res.status(400).json({ error: 'invalid_request' });
  await verifyHuman(req);
  await pool.query('insert into rsvp_responses(submission_key,guest_name,attending,guest_message,companions) values($1,$2,$3,$4,$5) on conflict(submission_key) do nothing', [input.submissionKey,name,input.attending,message,companions.map(name => name.trim())]);
  res.json({ recorded: true });
});
app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }));
const root = fileURLToPath(new URL('../', import.meta.url));
// Only explicitly public assets are served; never expose source, .env or dependencies.
for (const dir of ['assets','img']) app.use(`/${dir}`, express.static(path.join(root,dir)));
app.get('/', (req, res) => res.sendFile(path.join(root,'index.html')));
for (const file of publicFiles) app.get(`/${file}`, (req, res) => res.sendFile(path.join(root,file)));
app.get('/favicon.ico', (req, res) => res.redirect(301, '/assets/favicon-64.png'));
// Endereço inexistente: página em português com caminho de volta, em vez do "Cannot GET" padrão.
app.use((req, res) => {
  res.status(404).type('html').send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Página não encontrada — Laís &amp; Levy</title></head><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f7fa;color:#293b49;font:16px/1.6 Georgia,serif;text-align:center;padding:24px"><main><h1 style="font-weight:400;font-size:clamp(34px,8vw,56px);margin:0 0 12px">Página não encontrada</h1><p style="margin:0 0 24px">O endereço que você abriu não existe.</p><a href="/" style="display:inline-block;padding:14px 26px;border-radius:100px;background:#293b49;color:#fff;text-decoration:none;font-family:Arial,sans-serif">Voltar ao site do casamento</a></main></body></html>`);
});
app.use((error, req, res, next) => {
  const invalid = ['23514','23502','22P02','22003','22001'].includes(error.code);
  const unavailable = ['gift_not_available','invalid_contribution_amount','invalid_order_amount'].includes(error.message);
  const status = invalid ? 400 : unavailable ? 409 : error.status || 500;
  console.error('Request failed:', req.path, error.code || error.name);
  // Erros do leitor de JSON (corpo malformado ou grande demais) não devem expor detalhes internos.
  const bodyParserError = ['entity.parse.failed', 'entity.too.large', 'encoding.unsupported', 'request.aborted'].includes(error.type);
  res.status(status).json({ error: invalid || bodyParserError ? 'invalid_request' : unavailable || status < 500 ? error.message : status === 503 ? 'service_not_configured' : 'internal_error' });
});
