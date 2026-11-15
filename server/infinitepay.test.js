import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

test('InfinitePay: checkout e confirmação independente do navegador', { skip: !process.env.DATABASE_URL }, async t => {
  const { app } = await import('./app.js');
  const { pool } = await import('./db.js');
  const nativeFetch = globalThis.fetch;
  const giftId = randomUUID();
  const transactions = [];
  const orders = [];
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.on('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body) => nativeFetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  let verified = { success: true, paid: true, amount: 100, paid_amount: 110, capture_method: 'credit_card' };
  let linkFailure = false;
  let sent;
  process.env.PAYMENT_PROVIDER = 'infinitepay';
  process.env.PAYMENTS_ENABLED = 'true';
  process.env.INFINITEPAY_API_KEY = 'test-only';
  process.env.TURNSTILE_SECRET_KEY = 'test-only';
  process.env.SITE_URL = 'http://localhost:3000';
  process.env.API_PUBLIC_URL = 'http://localhost:3000/api';
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith('https://challenges.cloudflare.com/')) return Response.json({ success: true, hostname: 'localhost' });
    assert.equal(options.headers['X-Api-Key'], 'test-only');
    if (String(url).endsWith('/links')) {
      sent = JSON.parse(options.body);
      if (linkFailure) throw new Error('timeout after provider created link');
      return Response.json({ url: `https://checkout.infinitepay.io/test/${sent.order_nsu}`, slug: sent.order_nsu });
    }
    if (String(url).endsWith('/payment_check')) return Response.json(verified);
    throw new Error('Unexpected external request');
  };
  const checkout = async () => {
    const response = await post('/api/create-checkout', { giftId, guestName: 'Teste InfinitePay', guestEmail: 'test@example.com', turnstileToken: 'test' });
    assert.equal(response.status, 200);
    const data = await response.json();
    orders.push(data.orderId);
    return data.orderId;
  };
  const notification = order => {
    const id = randomUUID(); transactions.push(id);
    return { order_nsu: order, invoice_slug: order, transaction_nsu: id };
  };
  const status = async id => (await pool.query('select status from gift_orders where id=$1', [id])).rows[0].status;
  try {
    await pool.query(`insert into gifts(id,title,price_cents,unlimited_purchases) values($1,'Teste InfinitePay',100,true)`, [giftId]);
    await t.test('pagamentos desativados não geram checkout nem reserva', async () => {
      process.env.PAYMENTS_ENABLED = 'false';
      assert.equal((await post('/api/create-checkout', {})).status, 503);
      assert.equal((await pool.query('select 1 from gift_orders where gift_id=$1', [giftId])).rowCount, 0);
      process.env.PAYMENTS_ENABLED = 'true';
    });
    await t.test('checkout define valor no servidor, uso único e expiração', async () => {
      const order = await checkout();
      assert.equal(sent.items[0].price, 100);
      assert.equal(sent.options.single_payment, true);
      assert.ok(new Date(sent.options.valid_until) > new Date());
      assert.equal(sent.webhook_url, 'http://localhost:3000/api/infinitepay-webhook');
      assert.equal(await status(order), 'pending');
    });
    await t.test('aviso falso e valor divergente não aprovam a compra', async () => {
      const order = await checkout();
      const body = notification(order);
      verified = { success: false, paid: false };
      assert.equal((await post('/api/infinitepay-webhook', { ...body, paid: true, amount: 100 })).status, 200);
      assert.equal(await status(order), 'pending');
      verified = { success: true, paid: true, amount: 200, paid_amount: 200, capture_method: 'pix' };
      assert.equal((await post('/api/infinitepay-webhook', body)).status, 200);
      assert.equal(await status(order), 'review');
    });
    await t.test('retorno confirma valor original mesmo com taxa; webhook duplicado é idempotente', async () => {
      const order = await checkout();
      const body = notification(order);
      verified = { success: true, paid: true, amount: 100, paid_amount: 110, capture_method: 'credit_card' };
      const response = await post('/api/check-payment', { ...body, slug: body.invoice_slug });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).status, 'approved');
      assert.equal((await post('/api/infinitepay-webhook', body)).status, 200);
      assert.equal(await status(order), 'approved');
      assert.equal((await pool.query('select 1 from payment_events where provider_event_id=$1', [`infinitepay:${body.transaction_nsu}`])).rowCount, 1);
      verified = { success: true, paid: false };
      await post('/api/infinitepay-webhook', body);
      assert.equal(await status(order), 'approved');
    });
    await t.test('cobrança atrasada vai para revisão e slug trocado é recusado', async () => {
      const order = await checkout();
      const body = notification(order);
      assert.equal((await post('/api/infinitepay-webhook', { ...body, invoice_slug: 'different' })).status, 400);
      verified = { success: true, paid: true, amount: 100, paid_amount: 100, capture_method: 'pix' };
      await pool.query("update gift_orders set expires_at=now()-interval '1 minute' where id=$1", [order]);
      await post('/api/infinitepay-webhook', body);
      assert.equal(await status(order), 'review');
      assert.equal((await post('/api/check-payment', {})).status, 400);
    });
    await t.test('falha de rede mantém reserva para um link possivelmente criado', async () => {
      linkFailure = true;
      assert.equal((await post('/api/create-checkout', { giftId, guestName: 'Teste InfinitePay', guestEmail: 'test@example.com', turnstileToken: 'test' })).status, 502);
      const { rows } = await pool.query('select status from gift_orders where gift_id=$1 and checkout_url is null', [giftId]);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].status, 'created');
    });
  } finally {
    globalThis.fetch = nativeFetch;
    await new Promise(resolve => server.close(resolve));
    await pool.query('delete from payment_events where resource_id=any($1::text[])', [transactions]);
    await pool.query('delete from gift_orders where gift_id=$1', [giftId]);
    await pool.query('delete from gifts where id=$1', [giftId]);
    await pool.end();
  }
});
