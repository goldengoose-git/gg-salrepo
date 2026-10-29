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

// Limiti: tentativi falliti negli ultimi 15 minuti
const WINDOW = "interval '15 minutes'";
const MAX_PER_USER_IP = 5;
const MAX_PER_IP = 20;

export async function POST(req: Request) {
  const { username, password, turnstile } = await req.json().catch(() => ({}));
  if (!username || !password) return fail('Credenziali mancanti');
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const user = String(username).toLowerCase().trim().slice(0, 64);
  // blocco per troppi tentativi (se la tabella non esiste ancora, il login continua a funzionare)
  try {
    const c = await q<any>(
      `select count(*) filter (where username = $2)::int as u, count(*)::int as i
         from login_attempts where ip = $1 and ok = false and at > now() - ${WINDOW}`, [ip, user]);
    if ((c[0]?.u ?? 0) >= MAX_PER_USER_IP || (c[0]?.i ?? 0) >= MAX_PER_IP)
      return fail('Troppi tentativi. Riprova tra 15 minuti.', 429);
  } catch {}
  if (!(await turnstileOk(turnstile, ip === 'unknown' ? null : ip)))
    return fail('Verifica anti-bot non superata, riprova', 403);
  const rows = await q<any>('select * from users where username = $1', [user]);
  const u = rows[0];
  // confronto sempre eseguito per non rivelare se l'utente esiste
  const ok = await bcrypt.compare(String(password), u?.password_hash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi');
  if (!u || !ok) {
    await q('insert into login_attempts (ip, username, ok) values ($1,$2,false)', [ip, user]).catch(() => {});
    return fail('Utente o password errati', 401);
  }
  // login riuscito: azzera i fallimenti e pulisce i log più vecchi di 7 giorni
  await q('delete from login_attempts where (ip = $1 and username = $2 and ok = false) or at < now() - interval \'7 days\'', [ip, user]).catch(() => {});
  await createSession({ username: u.username, role: u.role, name: u.display_name });
  return json({ ok: true });
}
