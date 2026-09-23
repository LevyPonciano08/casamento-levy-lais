import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, isAllowedBrowserRequest, json } from '../_shared/http.ts';

type CheckoutInput = {
  giftId?: string;
  guestName?: string;
  guestEmail?: string;
  guestMessage?: string;
  publicName?: boolean;
  amountCents?: number;
  quantity?: number;
  turnstileToken?: string;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requiredEnvironment(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`missing_environment:${name}`);
  return value;
}

function cleanSiteUrl(value: string) {
  return value.replace(/\/$/, '');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(request) });
  }
  if (request.method !== 'POST') return json(request, { error: 'method_not_allowed' }, 405);
  if (!isAllowedBrowserRequest(request)) return json(request, { error: 'origin_not_allowed' }, 403);

  try {
    const input = await request.json() as CheckoutInput;
    const giftId = String(input.giftId ?? '');
    const guestName = String(input.guestName ?? '').trim();
    const guestEmail = String(input.guestEmail ?? '').trim().toLowerCase();
    const guestMessage = String(input.guestMessage ?? '').trim();
    const quantity = Number.isInteger(input.quantity) ? Number(input.quantity) : 1;
    const amountCents = Number.isInteger(input.amountCents) ? Number(input.amountCents) : null;

    if (!uuidPattern.test(giftId) || guestName.length < 2 || guestName.length > 120) {
      return json(request, { error: 'invalid_request' }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail) || guestEmail.length > 254) {
      return json(request, { error: 'invalid_email' }, 400);
    }
    if (guestMessage.length > 1000 || quantity < 1 || quantity > 100) {
      return json(request, { error: 'invalid_request' }, 400);
    }

    const turnstileToken = String(input.turnstileToken ?? '');
    if (!turnstileToken || turnstileToken.length > 2048) {
      return json(request, { error: 'human_verification_required' }, 403);
    }
    const remoteIp = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
    const turnstileResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: requiredEnvironment('TURNSTILE_SECRET_KEY'),
        response: turnstileToken,
        ...(remoteIp ? { remoteip: remoteIp } : {}),
        idempotency_key: crypto.randomUUID()
      })
    });
    const turnstileResult = await turnstileResponse.json();
    if (!turnstileResponse.ok || !turnstileResult.success) {
      console.warn('Turnstile validation failed', turnstileResult['error-codes']);
      return json(request, { error: 'human_verification_failed' }, 403);
    }

    const supabaseUrl = requiredEnvironment('SUPABASE_URL');
    const serviceRoleKey = requiredEnvironment('SUPABASE_SERVICE_ROLE_KEY');
    const mercadoPagoToken = requiredEnvironment('MERCADO_PAGO_ACCESS_TOKEN');
    const siteUrl = cleanSiteUrl(requiredEnvironment('SITE_URL'));
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: orderId, error: reserveError } = await supabase.rpc('reserve_gift_order', {
      p_gift_id: giftId,
      p_guest_name: guestName,
      p_guest_email: guestEmail,
      p_guest_message: guestMessage,
      p_public_name: Boolean(input.publicName),
      p_amount_cents: amountCents,
      p_quantity: quantity
    });

    if (reserveError || !orderId) {
      const unavailable = reserveError?.message.includes('gift_not_available');
      const invalidAmount = reserveError?.message.includes('invalid_contribution_amount');
      return json(request, {
        error: unavailable ? 'gift_not_available' : invalidAmount ? 'invalid_amount' : 'could_not_reserve'
      }, unavailable || invalidAmount ? 409 : 400);
    }

    const { data: order, error: orderError } = await supabase
      .from('gift_orders')
      .select('id, amount_cents, quantity, expires_at, gifts(id, title, description, image_path)')
      .eq('id', orderId)
      .single();

    if (orderError || !order) throw new Error('reserved_order_not_found');
    const gift = Array.isArray(order.gifts) ? order.gifts[0] : order.gifts;
    if (!gift) throw new Error('reserved_gift_not_found');

    let pictureUrl: string | undefined;
    if (gift.image_path) {
      pictureUrl = `${supabaseUrl}/storage/v1/object/public/gift-images/${gift.image_path}`;
    }

    const preferenceResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mercadoPagoToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': order.id
      },
      body: JSON.stringify({
        items: [{
          id: gift.id,
          title: gift.title,
          description: gift.description || 'Presente para Levy e Laís',
          category_id: 'gifts',
          currency_id: 'BRL',
          quantity: 1,
          unit_price: order.amount_cents / 100,
          ...(pictureUrl ? { picture_url: pictureUrl } : {})
        }],
        payer: { name: guestName, email: guestEmail },
        back_urls: {
          success: `${siteUrl}/pagamento.html?retorno=sucesso`,
          pending: `${siteUrl}/pagamento.html?retorno=pendente`,
          failure: `${siteUrl}/pagamento.html?retorno=falha`
        },
        auto_return: 'approved',
        notification_url: `${supabaseUrl}/functions/v1/mercado-pago-webhook`,
        external_reference: order.id,
        statement_descriptor: 'LEVY E LAIS',
        expires: true,
        expiration_date_to: order.expires_at,
        payment_methods: {
          excluded_payment_types: [
            { id: 'ticket' },
            { id: 'credit_card' },
            { id: 'debit_card' },
            { id: 'prepaid_card' },
            { id: 'digital_currency' }
          ],
          default_payment_method_id: 'pix'
        },
        metadata: { gift_id: gift.id, order_id: order.id }
      })
    });

    const preference = await preferenceResponse.json();
    const mercadoPagoEnvironment = (Deno.env.get('MERCADO_PAGO_ENVIRONMENT') ?? 'test').toLowerCase();
    const checkoutUrl = mercadoPagoEnvironment === 'production'
      ? preference.init_point
      : preference.sandbox_init_point;
    if (!preferenceResponse.ok || !preference.id || !checkoutUrl) {
      await supabase.from('gift_orders').update({ status: 'cancelled' }).eq('id', order.id);
      console.error('Mercado Pago preference error', preferenceResponse.status, preference);
      return json(request, { error: 'payment_provider_unavailable' }, 502);
    }

    const { error: updateError } = await supabase.from('gift_orders').update({
      mercado_pago_preference_id: preference.id,
      status: 'pending'
    }).eq('id', order.id);
    if (updateError) throw updateError;

    return json(request, { checkoutUrl, orderId: order.id });
  } catch (error) {
    console.error('create-checkout failed', error);
    return json(request, { error: 'internal_error' }, 500);
  }
});
