import bcrypt from 'bcryptjs';
import { createSession } from '@/lib/auth';
import { q } from '@/lib/db';
import { fail, json } from '@/lib/http';

// Cloudflare Turnstile: attivo solo se TURNSTILE_SECRET_KEY è impostata
async function turnstileOk(token: string | undefined, ip: string | null) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set('remoteip', ip);
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    return !!(await r.json()).success;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const { username, password, turnstile } = await req.json().catch(() => ({}));
  if (!username || !password) return fail('Credenziali mancanti');
  if (!(await turnstileOk(turnstile, req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null)))
    return fail('Verifica anti-bot non superata, riprova', 403);
  const rows = await q<any>('select * from users where username = $1', [String(username).toLowerCase().trim()]);
  const u = rows[0];
  // confronto sempre eseguito per non rivelare se l'utente esiste
  const ok = await bcrypt.compare(String(password), u?.password_hash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi');
  if (!u || !ok) return fail('Utente o password errati', 401);
  await createSession({ username: u.username, role: u.role, name: u.display_name });
  return json({ ok: true });
}
