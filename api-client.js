import { registryConfig } from './registry-config.js?v=20261029-postgres';
export async function api(path, { method = 'GET', body, raw = false } = {}) {
  const response = await fetch(`${registryConfig.apiBaseUrl}${path}`, {
    method, credentials: 'same-origin',
    headers: body ? { 'Content-Type': raw ? body.type : 'application/json' } : {},
    body: body ? raw ? body : JSON.stringify(body) : undefined
  });
  const result = await response.json().catch(() => ({}));
  // Sessão do painel expirada no meio do uso: avisa a página para voltar ao login.
  if (response.status === 401 && path.startsWith('/admin')) window.dispatchEvent(new Event('admin-session-expired'));
  if (!response.ok) throw new Error(result.error || 'request_failed');
  return result;
}
