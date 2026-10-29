import bcrypt from 'bcryptjs';
import { createSession } from '@/lib/auth';
import { q } from '@/lib/db';
import { fail, json } from '@/lib/http';

export async function POST(req: Request) {
  const { username, password } = await req.json().catch(() => ({}));
  if (!username || !password) return fail('Credenziali mancanti');
  const rows = await q<any>('select * from users where username = $1', [String(username).toLowerCase().trim()]);
  const u = rows[0];
  // confronto sempre eseguito per non rivelare se l'utente esiste
  const ok = await bcrypt.compare(String(password), u?.password_hash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi');
  if (!u || !ok) return fail('Utente o password errati', 401);
  await createSession({ username: u.username, role: u.role, name: u.display_name });
  return json({ ok: true });
}
