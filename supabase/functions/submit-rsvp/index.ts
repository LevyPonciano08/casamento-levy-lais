import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, isAllowedBrowserRequest, json } from '../_shared/http.ts';

type RsvpInput = {
  submissionKey?: string;
  name?: string;
  attending?: boolean;
  message?: string;
  turnstileToken?: string;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requiredEnvironment(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`missing_environment:${name}`);
  return value;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) });
  if (request.method !== 'POST') return json(request, { error: 'method_not_allowed' }, 405);
  if (!isAllowedBrowserRequest(request)) return json(request, { error: 'origin_not_allowed' }, 403);

  let input: RsvpInput;
  try {
    input = await request.json();
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return json(request, { error: 'invalid_request' }, 400);
    }
  } catch {
    return json(request, { error: 'invalid_request' }, 400);
  }

  const submissionKey = typeof input.submissionKey === 'string' ? input.submissionKey : '';
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const message = typeof input.message === 'string' ? input.message.trim() : '';
  if (!uuidPattern.test(submissionKey) || name.length < 2 || name.length > 120 ||
      typeof input.attending !== 'boolean' || message.length > 300) {
    return json(request, { error: 'invalid_request' }, 400);
  }

  const turnstileToken = typeof input.turnstileToken === 'string' ? input.turnstileToken : '';
  if (!turnstileToken || turnstileToken.length > 2048) {
    return json(request, { error: 'human_verification_required' }, 403);
  }

  try {
    const remoteIp = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
    const verification = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: requiredEnvironment('TURNSTILE_SECRET_KEY'),
        response: turnstileToken,
        ...(remoteIp ? { remoteip: remoteIp } : {})
      })
    });
    const verified = await verification.json();
    if (!verification.ok || !verified.success) {
      return json(request, { error: 'human_verification_failed' }, 403);
    }

    const supabase = createClient(
      requiredEnvironment('SUPABASE_URL'),
      requiredEnvironment('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { error } = await supabase.from('rsvp_responses').insert({
      submission_key: submissionKey,
      guest_name: name,
      attending: input.attending,
      guest_message: message
    });
    if (error && error.code !== '23505') throw error;
    return json(request, { recorded: true });
  } catch (error) {
    console.error('RSVP submission failed', error instanceof Error ? error.message : 'unknown_error');
    return json(request, { error: 'submission_unavailable' }, 503);
  }
});
