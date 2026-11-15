import { createHmac, timingSafeEqual } from 'node:crypto';
import { pool, transaction } from './db.js';

export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function required(name) {
  if (!process.env[name]) throw Object.assign(new Error('service_not_configured'), { status: 503 });
  return process.env[name];
}
export async function verifyHuman(req) {
  const token = req.body?.turnstileToken;
  if (typeof token !== 'string' || !token || token.length > 2048) throw Object.assign(new Error('human_verification_required'), { status: 403 });
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: required('TURNSTILE_SECRET_KEY'), response: token, remoteip: req.ip }),
    signal: AbortSignal.timeout(15000)
  });
  const result = await response.json();
  const allowedHosts = (process.env.ALLOWED_ORIGINS || process.env.SITE_URL || 'http://localhost:3000').split(',').map(o => new URL(o.trim()).hostname);
  if (!response.ok || !result.success || !allowedHosts.includes(result.hostname)) throw Object.assign(new Error('human_verification_failed'), { status: 403 });
}
export async function checkout(req, res) {
  if (process.env.PAYMENTS_ENABLED !== 'true') return res.status(503).json({ error: 'payments_not_enabled' });
  const input = req.body || {};
  const name = String(input.guestName || '').trim();
  const email = String(input.guestEmail || '').trim().toLowerCase();
  const message = String(input.guestMessage || '').trim();
  const quantity = input.quantity ?? 1;
  if (!uuidPattern.test(input.giftId) || name.length < 2 || name.length > 120 || email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || message.length > 1000 || !Number.isInteger(quantity) || quantity < 1 || quantity > 100 ||
      (input.amountCents != null && (!Number.isInteger(input.amountCents) || input.amountCents < 1 || input.amountCents > 100000000))) {
    return res.status(400).json({ error: 'invalid_request' });
  }
  const token = required('MERCADO_PAGO_ACCESS_TOKEN');
  const site = required('SITE_URL').replace(/\/$/, '');
  const api = required('API_PUBLIC_URL').replace(/\/$/, '');
  await verifyHuman(req);
  const { rows: [{ id }] } = await pool.query('select reserve_gift_order($1,$2,$3,$4,$5,$6,$7) as id',
    [input.giftId, name, email, message, true, input.amountCents ?? null, quantity]);
  try {
    const { rows: [order] } = await pool.query(`select o.*, g.title,g.description from gift_orders o join gifts g on g.id=o.gift_id where o.id=$1`, [id]);
    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': id },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        items: [{ id: order.gift_id, title: order.title, description: order.description || 'Presente para Levy e Laís', category_id: 'gifts', currency_id: 'BRL', quantity: 1, unit_price: order.amount_cents / 100 }],
        payer: { name, email },
        back_urls: { success: `${site}/pagamento.html?retorno=sucesso`, pending: `${site}/pagamento.html?retorno=pendente`, failure: `${site}/pagamento.html?retorno=falha` },
        auto_return: 'approved', notification_url: `${api}/mercado-pago-webhook`, external_reference: id,
        statement_descriptor: 'LEVY E LAIS', expires: true, expiration_date_to: order.expires_at.toISOString(),
        payment_methods: { excluded_payment_types: ['ticket', 'credit_card', 'debit_card', 'prepaid_card', 'digital_currency'].map(id => ({ id })), default_payment_method_id: 'pix' },
        metadata: { gift_id: order.gift_id, order_id: id }
      })
    });
    const preference = await response.json();
    const checkoutUrl = process.env.MERCADO_PAGO_ENVIRONMENT === 'production' ? preference.init_point : preference.sandbox_init_point;
    if (!response.ok || !preference.id || !checkoutUrl) throw new Error('payment_provider_unavailable');
    await pool.query("update gift_orders set mercado_pago_preference_id=$1,status=case when status='created' then 'pending' else status end where id=$2", [preference.id, id]);
    res.json({ checkoutUrl, orderId: id });
  } catch {
    await pool.query("update gift_orders set status='cancelled' where id=$1 and status='created'", [id]);
    res.status(502).json({ error: 'payment_provider_unavailable' });
  }
}
export function validSignature(signature, requestId, resourceId, secret, now = Date.now()) {
  const parts = Object.fromEntries(String(signature || '').split(',').map(part => part.trim().split('=')));
  if (!requestId || !parts.ts || !/^[a-f0-9]{64}$/i.test(parts.v1 || '') || !Number.isFinite(Number(parts.ts)) || Math.abs(now / 1000 - Number(parts.ts)) > 600) return false;
  const digest = createHmac('sha256', secret).update(`id:${resourceId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`).digest();
  return timingSafeEqual(digest, Buffer.from(parts.v1, 'hex'));
}
export function paymentStatus(status) {
  return ({ approved: 'approved', pending: 'pending', authorized: 'pending', in_process: 'pending', rejected: 'rejected', cancelled: 'cancelled', refunded: 'refunded', charged_back: 'refunded' })[status] || 'review';
}
export async function webhook(req, res) {
  const body = req.body || {};
  const resourceId = String(req.query['data.id'] ?? body.data?.id ?? '');
  if (!resourceId || !validSignature(req.get('x-signature'), req.get('x-request-id'), resourceId, required('MERCADO_PAGO_WEBHOOK_SECRET'))) return res.sendStatus(401);
  const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(resourceId)}`, {
    headers: { Authorization: `Bearer ${required('MERCADO_PAGO_ACCESS_TOKEN')}` }, signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) return res.sendStatus(503);
  const payment = await response.json();
  if (!uuidPattern.test(payment.external_reference || '')) return res.sendStatus(200);
  await transaction(async client => {
    const { rows: [order] } = await client.query('select * from gift_orders where id=$1 for update', [payment.external_reference]);
    if (!order || order.payment_provider !== 'mercado_pago') return;
    const amount = Math.round(Number(payment.transaction_amount) * 100);
    const matches = amount === order.amount_cents && payment.currency_id === 'BRL';
    const mapped = paymentStatus(payment.status);
    let status = mapped === 'approved' && !matches ? 'review' : mapped;
    const incoming = String(payment.id);
    const current = !order.mercado_pago_payment_id || order.mercado_pago_payment_id === incoming;
    if (order.status === 'approved' && (mapped !== 'refunded' || !current)) status = 'approved';
    const eventId = String(body.id ?? `${body.action ?? 'payment'}:${resourceId}:${payment.status}`);
    await client.query(`insert into payment_events(provider_event_id,resource_id,action,processed,details) values($1,$2,$3,true,$4)
      on conflict(provider_event_id) do update set processed=true`, [eventId, resourceId, String(body.action ?? body.type ?? 'payment'), JSON.stringify({ payment_status: payment.status, amount_cents: amount, currency: payment.currency_id, amount_matches: matches })]);
    await client.query(`update gift_orders set status=$1,mercado_pago_payment_id=$2,payment_method=$3,
      paid_at=case when $1='approved' then coalesce(paid_at,$4::timestamptz,now()) else paid_at end where id=$5`,
    [status, order.status === 'approved' && !current ? order.mercado_pago_payment_id : incoming,
      order.status === 'approved' && !current ? order.payment_method : payment.payment_type_id ?? payment.payment_method_id ?? null, payment.date_approved || null, order.id]);
  });
  res.sendStatus(200);
}
