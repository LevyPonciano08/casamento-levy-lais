import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { pool } from './db.js';

export const hashToken = token => createHash('sha256').update(token).digest('hex');
export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  // Hash malformado no banco nunca deve derrubar o login nem aceitar a senha.
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}
export function sessionToken(req) {
  return (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('wedding_session='))?.slice(16) || '';
}
export const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/api' };
export async function requireAdmin(req, res, next) {
  const { rows } = await pool.query(`select a.id,a.email from admin_sessions s join admin_accounts a on a.id=s.user_id
    where s.token_hash=$1 and s.expires_at > now()`, [hashToken(sessionToken(req))]);
  if (!rows[0]) return res.status(401).json({ error: 'authentication_required' });
  req.user = rows[0];
  next();
}
export async function createSession(userId) {
  const token = randomBytes(32).toString('hex');
  await pool.query('delete from admin_sessions where expires_at <= now()');
  await pool.query("insert into admin_sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '8 hours')", [hashToken(token), userId]);
  return token;
}
