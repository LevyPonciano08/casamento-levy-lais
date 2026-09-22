export function getAllowedOrigin(request: Request) {
  const configured = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const origin = request.headers.get('origin') ?? '';
  return configured.includes(origin) ? origin : configured[0] ?? '';
}

export function corsHeaders(request: Request) {
  const allowedOrigin = getAllowedOrigin(request);
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  };
}

export function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json; charset=utf-8' }
  });
}

export function isAllowedBrowserRequest(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  return getAllowedOrigin(request) === origin;
}

