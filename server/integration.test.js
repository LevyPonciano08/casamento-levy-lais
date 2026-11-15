import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHmac } from 'node:crypto';

test('API PostgreSQL: autenticação, catálogo, reservas, RSVP e pagamentos', { skip: !process.env.DATABASE_URL }, async t => {
  const { app } = await import('./app.js');
  const { pool } = await import('./db.js');
  const { hashPassword } = await import('./auth.js');
  const { validSignature } = await import('./payments.js');
  const nativeFetch = globalThis.fetch;
  const adminId = randomUUID();
  const email = `test-${adminId}@example.com`;
  const password = randomUUID();
  const ids = [];
  const imageIds = [];
  const submission = randomUUID();
  const eventId = randomUUID();
  let cookie = '';
  let orderId;
  let payment = {};
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.on('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, options = {}) => nativeFetch(`${base}${path}`, { ...options, headers: { Cookie: cookie, ...options.headers } });
  const json = body => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const gift = { title: 'Teste de migração', category: 'Teste', description: '', gift_mode: 'unit', price_cents: 100, quantity_total: 1, unlimited_purchases: false, is_active: true };
  await pool.query('insert into admin_accounts(id,email,password_hash) values($1,$2,$3)', [adminId,email,hashPassword(password)]);
  process.env.MERCADO_PAGO_ACCESS_TOKEN = 'test-token';
  process.env.PAYMENT_PROVIDER = 'mercado_pago';
  process.env.MERCADO_PAGO_WEBHOOK_SECRET = 'test-webhook-secret';
  process.env.TURNSTILE_SECRET_KEY = 'test-secret';
  process.env.SITE_URL = 'http://localhost:3000';
  process.env.API_PUBLIC_URL = 'http://localhost:3000/api';
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith('https://challenges.cloudflare.com/')) return Response.json({ success: true, hostname: 'localhost' });
    if (url === 'https://api.mercadopago.com/checkout/preferences') return Response.json({ id: randomUUID(), sandbox_init_point: 'https://sandbox.mercadopago.com/test' });
    if (String(url).startsWith('https://api.mercadopago.com/v1/payments/')) return Response.json(payment);
    throw new Error('Unexpected external request');
  };
  try {
    await t.test('dados privados e arquivos secretos ficam protegidos', async () => {
      assert.equal((await request('/api/admin/dashboard')).status, 401);
      assert.equal((await request('/api/admin/gifts', json(gift))).status, 401);
      for (const file of ['/.env','/.git/config','/server/db.js','/package.json','/node_modules/pg/package.json']) assert.equal((await request(file)).status, 404);
      assert.equal((await request('/api/health')).status, 200);
    });
    await t.test('login valida senha, cria cookie HttpOnly e rejeita origem externa', async () => {
      assert.equal((await request('/api/login', json({ email,password: 'wrong' }))).status, 401);
      const response = await request('/api/login', json({ email,password }));
      assert.equal(response.status, 200);
      const header = response.headers.get('set-cookie');
      assert.match(header, /HttpOnly/);
      assert.match(header, /SameSite=Strict/);
      cookie = header.split(';')[0];
      assert.equal((await request('/api/session')).status, 200);
      assert.equal((await request('/api/admin/gifts', { ...json(gift), headers: { 'Content-Type': 'application/json', Origin: 'https://invalid.example' } })).status, 403);
    });
    await t.test('cadastro e imagem funcionam no PostgreSQL; conteúdo inválido é recusado', async () => {
      const response = await request('/api/admin/gifts', json(gift));
      assert.equal(response.status, 200);
      ids.push((await response.json()).id);
      assert.equal((await request('/api/admin/images', { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: 'not png' })).status, 400);
      const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8mUAAAAASUVORK5CYII=', 'base64');
      const upload = await request('/api/admin/images', { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: image });
      assert.equal(upload.status, 200);
      const { path } = await upload.json();
      imageIds.push(path);
      const downloaded = await request(`/api/images/${path}`);
      assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), image);
      const catalog = await (await request('/api/gifts')).json();
      assert.ok(catalog.some(g => g.id === ids[0]));
      assert.ok(!Object.hasOwn(catalog.find(g => g.id === ids[0]), 'created_by'));
    });
    await t.test('reservas simultâneas não vendem a mesma unidade duas vezes', async () => {
      const reserve = () => pool.query('select reserve_gift_order($1,$2,$3)', [ids[0],'Teste','test@example.com']);
      const results = await Promise.allSettled([reserve(),reserve()]);
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
      assert.match(results.find(r => r.status === 'rejected').reason.message, /gift_not_available/);
      const catalog = await (await request('/api/gifts')).json();
      assert.equal(catalog.find(g=>g.id===ids[0]).available_quantity, 0);
      await pool.query("update gift_orders set expires_at=now()-interval '1 minute' where gift_id=$1", [ids[0]]);
      assert.equal((await (await request('/api/gifts')).json()).find(g=>g.id===ids[0]).available_quantity, 1);
    });
    await t.test('cotas respeitam mínimo e total; presentes ilimitados continuam disponíveis', async () => {
      const quota = await request('/api/admin/gifts', json({ ...gift, gift_mode: 'quota', price_cents: 1000, minimum_contribution_cents: 200 }));
      const id = (await quota.json()).id;
      ids.push(id);
      await assert.rejects(pool.query('select reserve_gift_order($1,$2,$3,$4,$5,$6,$7)', [id,'Teste','test@example.com','',false,100,1]), /invalid_contribution_amount/);
      await pool.query('select reserve_gift_order($1,$2,$3,$4,$5,$6,$7)', [id,'Teste','test@example.com','',false,800,1]);
      await assert.rejects(pool.query('select reserve_gift_order($1,$2,$3,$4,$5,$6,$7)', [id,'Teste','test@example.com','',false,300,1]), /invalid_contribution_amount/);
      const unlimited = await request('/api/admin/gifts', json({ ...gift, unlimited_purchases: true }));
      const unlimitedId = (await unlimited.json()).id;
      ids.push(unlimitedId);
      for (let i=0;i<2;i++) await pool.query('select reserve_gift_order($1,$2,$3)', [unlimitedId,'Teste','test@example.com']);
      assert.equal((await (await request('/api/gifts')).json()).find(g=>g.id===unlimitedId).available_quantity, 100);
    });
    await t.test('RSVP é validado e idempotente', async () => {
      assert.equal((await request('/api/submit-rsvp', json({ name: 'X' }))).status, 400);
      const payload = { submissionKey: submission, name: 'Teste', attending: true, companions: ['Acompanhante um', 'Acompanhante dois'], turnstileToken: 'test' };
      assert.equal((await request('/api/submit-rsvp', json({ ...payload, companions: 'invalid' }))).status, 400);
      assert.equal((await request('/api/submit-rsvp', json({ ...payload, companions: ['X'] }))).status, 400);
      assert.equal((await request('/api/submit-rsvp', json({ ...payload, companions: Array(21).fill('Nome') }))).status, 400);
      assert.equal((await request('/api/submit-rsvp', json({ ...payload, attending: false }))).status, 400);
      for (let i=0;i<2;i++) assert.equal((await request('/api/submit-rsvp', json(payload))).status, 200);
      assert.equal((await pool.query('select 1 from rsvp_responses where submission_key=$1', [submission])).rowCount, 1);
      assert.deepEqual((await pool.query('select companions from rsvp_responses where submission_key=$1', [submission])).rows[0].companions, payload.companions);
      const dashboard = await (await request('/api/admin/dashboard')).json();
      assert.deepEqual(dashboard.rsvps.find(r => r.guest_name === 'Teste' && r.companions?.length === 2).companions, payload.companions);
    });
    await t.test('checkout desativado por padrão; reserva e integra com provedor quando habilitado', async () => {
      process.env.PAYMENTS_ENABLED = 'false';
      assert.equal((await request('/api/create-checkout', json({}))).status, 503);
      process.env.PAYMENTS_ENABLED = 'true';
      const response = await request('/api/create-checkout', json({ giftId: ids[0], guestName: 'Teste', guestEmail: 'test@example.com', quantity: 1, turnstileToken: 'test' }));
      assert.equal(response.status, 200);
      orderId = (await response.json()).orderId;
      assert.equal((await pool.query('select status from gift_orders where id=$1', [orderId])).rows[0].status, 'pending');
    });
    const notify = async () => {
      const ts = Math.floor(Date.now()/1000).toString();
      const requestId = randomUUID();
      const resourceId = '12345';
      const digest = createHmac('sha256',process.env.MERCADO_PAGO_WEBHOOK_SECRET).update(`id:${resourceId};request-id:${requestId};ts:${ts};`).digest('hex');
      return request('/api/mercado-pago-webhook?data.id=12345', { ...json({ id: eventId, data: { id: resourceId } }), headers: { 'Content-Type':'application/json', 'x-request-id':requestId, 'x-signature':`ts=${ts},v1=${digest}` } });
    };
    await t.test('webhook valida assinatura e valor; duplicatas não rebaixam pagamento aprovado', async () => {
      assert.equal(validSignature('ts=1,v1=abc','id','123','secret'), false);
      assert.equal((await request('/api/mercado-pago-webhook', json({ data: { id: '12345' } }))).status, 401);
      payment = { id: '12345', external_reference: orderId, transaction_amount: 2, currency_id: 'BRL', status: 'approved' };
      assert.equal((await notify()).status, 200);
      assert.equal((await pool.query('select status from gift_orders where id=$1',[orderId])).rows[0].status,'review');
      payment.transaction_amount = 1;
      assert.equal((await notify()).status, 200);
      payment.status = 'pending';
      assert.equal((await notify()).status, 200);
      assert.equal((await pool.query('select status from gift_orders where id=$1',[orderId])).rows[0].status,'approved');
      payment.status = 'refunded';
      assert.equal((await notify()).status, 200);
      assert.equal((await pool.query('select status from gift_orders where id=$1',[orderId])).rows[0].status,'refunded');
    });
    await t.test('exclusão arquiva presentes com pedidos; logout revoga a sessão', async () => {
      assert.equal((await request(`/api/admin/gifts/${ids[0]}`, { method: 'DELETE' })).status, 200);
      assert.ok((await pool.query('select archived_at from gifts where id=$1',[ids[0]])).rows[0].archived_at);
      assert.equal((await request('/api/logout', { method: 'POST' })).status, 200);
      assert.equal((await request('/api/admin/dashboard')).status, 401);
    });
  } finally {
    globalThis.fetch = nativeFetch;
    await new Promise(resolve => server.close(resolve));
    await pool.query('delete from payment_events where provider_event_id=$1',[eventId]);
    await pool.query('delete from gift_orders where gift_id=any($1::uuid[])',[ids]);
    await pool.query('delete from gifts where created_by=$1',[adminId]);
    await pool.query('delete from admin_audit_log where admin_user_id=$1',[adminId]);
    await pool.query('delete from admin_accounts where id=$1',[adminId]);
    await pool.query('delete from gift_images where path=any($1::text[])',[imageIds]);
    await pool.query('delete from rsvp_responses where submission_key=$1',[submission]);
    await pool.end();
  }
});
