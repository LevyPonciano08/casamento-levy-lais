import { pool } from './db.js';
import { hashPassword } from './auth.js';
const { ADMIN_EMAIL: email, ADMIN_PASSWORD: password } = process.env;
try {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length < 12 || password.length > 512) throw new Error('Preencha ADMIN_EMAIL válido e ADMIN_PASSWORD (12 a 512 caracteres) no ambiente local.');
  await pool.query('insert into admin_accounts(email,password_hash) values($1,$2)', [email.trim().toLowerCase(), hashPassword(password)]);
  console.log('Administrador criado.');
} catch (error) { console.error(error.code === '23505' ? 'Administrador já existe.' : error.message); process.exitCode = 1; }
finally { await pool.end(); }
