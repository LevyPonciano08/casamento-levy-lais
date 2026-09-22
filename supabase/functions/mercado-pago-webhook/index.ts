import { createClient } from 'npm:@supabase/supabase-js@2';

function requiredEnvironment(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`missing_environment:${name}`);
  return value;
}

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function validSignature(request: Request, resourceId: string) {
  const signature = request.headers.get('x-signature') ?? '';
  const requestId = request.headers.get('x-request-id') ?? '';
  const parts = Object.fromEntries(signature.split(',').map((part) => {
    const [key, ...value] = part.trim().split('=');
    return [key, value.join('=')];
  }));
  if (!parts.ts || !parts.v1 || !requestId) return false;

  const timestamp = Number(parts.ts);
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 600) return false;

  const manifest = `id:${resourceId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(requiredEnvironment('MERCADO_PAGO_WEBHOOK_SECRET')),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const digest = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest)));
  if (digest.length !== parts.v1.length) return false;
  let difference = 0;
  for (let index = 0; index < digest.length; index += 1) {
    difference |= digest.charCodeAt(index) ^ parts.v1.charCodeAt(index);
  }
  return difference === 0;
}

function orderStatus(paymentStatus: string) {
  if (paymentStatus === 'approved') return 'approved';
  if (['pending', 'authorized', 'in_process'].includes(paymentStatus)) return 'pending';
  if (paymentStatus === 'rejected') return 'rejected';
  if (paymentStatus === 'cancelled') return 'cancelled';
  if (['refunded', 'charged_back'].includes(paymentStatus)) return 'refunded';
  return 'review';
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const body = await request.json().catch(() => ({}));
    const url = new URL(request.url);
    const resourceId = String(url.searchParams.get('data.id') ?? body?.data?.id ?? '');
    if (!resourceId || !(await validSignature(request, resourceId))) {
      return new Response('Invalid signature', { status: 401 });
    }

    const token = requiredEnvironment('MERCADO_PAGO_ACCESS_TOKEN');
    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(resourceId)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!paymentResponse.ok) {
      console.error('Could not retrieve payment', resourceId, paymentResponse.status);
      return new Response('Temporary failure', { status: 503 });
    }
    const payment = await paymentResponse.json();
    const orderId = String(payment.external_reference ?? '');
    if (!orderId) return new Response('Ignored', { status: 200 });

    const supabase = createClient(
      requiredEnvironment('SUPABASE_URL'),
      requiredEnvironment('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { data: order, error: orderError } = await supabase
      .from('gift_orders')
      .select('id, amount_cents, status, mercado_pago_payment_id, payment_method')
      .eq('id', orderId)
      .single();
    if (orderError || !order) return new Response('Ignored', { status: 200 });

    const receivedCents = Math.round(Number(payment.transaction_amount ?? 0) * 100);
    const amountsMatch = receivedCents === order.amount_cents && payment.currency_id === 'BRL';
    const mappedStatus = orderStatus(String(payment.status ?? ''));
    let status = mappedStatus === 'approved' && !amountsMatch ? 'review' : mappedStatus;
    const incomingPaymentId = String(payment.id);
    const isCurrentPayment = !order.mercado_pago_payment_id || order.mercado_pago_payment_id === incomingPaymentId;
    // Late or duplicated notifications must not turn an approved order back into pending/rejected.
    // A refund only affects the order when it belongs to the payment that was actually approved.
    if (order.status === 'approved' && (mappedStatus !== 'refunded' || !isCurrentPayment)) status = 'approved';
    const providerEventId = String(body?.id ?? `${body?.action ?? 'payment'}:${resourceId}:${payment.status}`);

    await supabase.from('payment_events').upsert({
      provider_event_id: providerEventId,
      resource_id: resourceId,
      action: String(body?.action ?? body?.type ?? 'payment'),
      processed: false,
      details: {
        payment_status: payment.status,
        amount_cents: receivedCents,
        currency: payment.currency_id,
        amount_matches: amountsMatch
      }
    }, { onConflict: 'provider_event_id', ignoreDuplicates: true });

    const update: Record<string, unknown> = {
      status,
      mercado_pago_payment_id: order.status === 'approved' && !isCurrentPayment
        ? order.mercado_pago_payment_id
        : incomingPaymentId,
      payment_method: order.status === 'approved' && !isCurrentPayment
        ? order.payment_method
        : payment.payment_type_id ?? payment.payment_method_id ?? null
    };
    if (status === 'approved') update.paid_at = payment.date_approved ?? new Date().toISOString();

    const { error: updateError } = await supabase.from('gift_orders').update(update).eq('id', order.id);
    if (updateError) throw updateError;
    await supabase.from('payment_events').update({ processed: true }).eq('provider_event_id', providerEventId);

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('mercado-pago-webhook failed', error);
    return new Response('Temporary failure', { status: 500 });
  }
});
