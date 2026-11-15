import { pool, transaction } from './db.js';
import { required, uuidPattern, verifyHuman } from './payments.js';

const api = 'https://api.checkout.infinitepay.io';
const safeId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,200}$/.test(value);
function headers() {
  return { 'Content-Type': 'application/json', 'X-Api-Key': required('INFINITEPAY_API_KEY') };
}
async function providerRequest(path, body) {
  const response = await fetch(`${api}${path}`, {
    method: 'POST', headers: headers(), body: JSON.stringify(body), signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw Object.assign(new Error('payment_provider_unavailable'), { status: 502 });
  return response.json();
}
export async function infiniteCheckout(req, res) {
  if (process.env.PAYMENTS_ENABLED !== 'true') return res.status(503).json({ error: 'payments_not_enabled' });
  const input = req.body || {};
  const name = typeof input.guestName === 'string' ? input.guestName.trim() : '';
  const email = typeof input.guestEmail === 'string' ? input.guestEmail.trim().toLowerCase() : '';
  const message = typeof input.guestMessage === 'string' ? input.guestMessage.trim() : '';
  const quantity = input.quantity ?? 1;
  if (!uuidPattern.test(input.giftId || '') || name.length < 2 || name.length > 120 || email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || message.length > 1000 || !Number.isInteger(quantity) || quantity < 1 || quantity > 100 ||
      (input.amountCents != null && (!Number.isInteger(input.amountCents) || input.amountCents < 100 || input.amountCents > 100000000))) {
    return res.status(400).json({ error: 'invalid_request' });
  }
  headers();
  const site = required('SITE_URL').replace(/\/$/, '');
  const publicApi = required('API_PUBLIC_URL').replace(/\/$/, '');
  await verifyHuman(req);
  // Commit provider and reservation together before exposing the order to a webhook.
  const order = await transaction(async client => {
    const { rows: [{ id }] } = await client.query('select reserve_gift_order($1,$2,$3,$4,$5,$6,$7) as id',
      [input.giftId, name, email, message, true, input.amountCents ?? null, quantity]);
    await client.query("update gift_orders set payment_provider='infinitepay' where id=$1", [id]);
    const { rows: [row] } = await client.query('select o.*,g.title from gift_orders o join gifts g on g.id=o.gift_id where o.id=$1', [id]);
    return row;
  });
  try {
    if (order.amount_cents < 100) throw new Error('invalid_order_amount');
    const result = await providerRequest('/links', {
      items: [{ description: `${order.title} — Laís & Levy`, price: order.amount_cents, quantity: 1 }],
      order_nsu: order.id, customer: { name, email },
      redirect_url: `${site}/pagamento.html`, webhook_url: `${publicApi}/infinitepay-webhook`,
      options: { single_payment: true, valid_until: order.expires_at.toISOString(), require_delivery_address: false }
    });
    const checkoutUrl = result.checkout_url || result.link || result.url;
    const url = new URL(checkoutUrl);
    if (url.protocol !== 'https:' || url.hostname !== 'checkout.infinitepay.io') throw new Error('invalid_checkout_url');
    const slug = result.slug || url.pathname.split('/').filter(Boolean).at(-1);
    if (!safeId(slug)) throw new Error('invalid_checkout_slug');
    await pool.query(`update gift_orders set checkout_url=$1,infinitepay_slug=$2,
      status=case when status='created' then 'pending' else status end where id=$3`, [url.href, slug, order.id]);
    res.json({ checkoutUrl: url.href, orderId: order.id });
  } catch {
    // A network failure may occur after the provider created a live link. Keep the
    // reservation until its expiry; a verified late notification remains traceable.
    res.status(502).json({ error: 'payment_provider_unavailable' });
  }
}

export async function confirmInfinitePayment(input) {
  const orderId = input?.order_nsu;
  const slug = input?.invoice_slug || input?.slug;
  const transactionId = input?.transaction_nsu;
  if (!uuidPattern.test(orderId || '') || !safeId(slug) || !safeId(transactionId)) {
    throw Object.assign(new Error('invalid_request'), { status: 400 });
  }
  const { rows: [existing] } = await pool.query("select * from gift_orders where id=$1 and payment_provider='infinitepay'", [orderId]);
  if (!existing) throw Object.assign(new Error('not_found'), { status: 404 });
  if (existing.infinitepay_slug && existing.infinitepay_slug !== slug) throw Object.assign(new Error('invalid_request'), { status: 400 });
  // Neither the webhook body nor the return URL is evidence of payment.
  const checked = await providerRequest('/payment_check', { order_nsu: orderId, slug, transaction_nsu: transactionId });
  if (checked.success !== true || checked.paid !== true) {
    return { status: ['approved', 'refunded', 'review'].includes(existing.status) ? existing.status : 'pending' };
  }
  return transaction(async client => {
    // Match reserve_gift_order's lock order: gift first, then its order.
    await client.query('select id from gifts where id=$1 for update', [existing.gift_id]);
    const { rows: [order] } = await client.query('select * from gift_orders where id=$1 for update', [orderId]);
    const amountMatches = Number.isInteger(checked.amount) && checked.amount === order.amount_cents;
    const samePayment = !order.infinitepay_transaction_id || order.infinitepay_transaction_id === transactionId;
    const expired = new Date(order.expires_at).getTime() <= Date.now();
    const method = ['pix', 'credit_card'].includes(checked.capture_method) ? checked.capture_method : null;
    let status = amountMatches && samePayment && !expired && ['created', 'pending'].includes(order.status) ? 'approved' : 'review';
    if (['approved', 'refunded'].includes(order.status)) status = order.status;
    // A repeated, already verified transaction must not create another purchase.
    const eventId = `infinitepay:${transactionId}`;
    const details = { order_id: orderId, amount_cents: checked.amount, paid_amount: checked.paid_amount,
      amount_matches: amountMatches, same_payment: samePayment, expired, status };
    await client.query(`insert into payment_events(provider_event_id,resource_id,action,processed,details)
      values($1,$2,'paid',true,$3) on conflict(provider_event_id) do nothing`, [eventId, transactionId, JSON.stringify(details)]);
    await client.query(`update gift_orders set status=$1,infinitepay_slug=coalesce(infinitepay_slug,$2),
      infinitepay_transaction_id=coalesce(infinitepay_transaction_id,$3),payment_method=coalesce(payment_method,$4),
      paid_at=coalesce(paid_at,now()) where id=$5`, [status, slug, transactionId, method, orderId]);
    return { status };
  });
}
export async function infiniteWebhook(req, res) {
  await confirmInfinitePayment(req.body);
  res.json({ received: true });
}
export async function infiniteReturn(req, res) {
  res.json(await confirmInfinitePayment(req.body));
}
