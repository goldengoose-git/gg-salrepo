import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSession } from './auth';
import type { Me } from './types';
import { q } from './db';

export const json = (data: any, status = 200) => NextResponse.json(data, { status });
export const fail = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });

export async function needUser(): Promise<Me | NextResponse> {
  const me = await getSession();
  return me ?? fail('Non autenticato', 401);
}
export const isErr = (x: any): x is NextResponse => x instanceof NextResponse;

/** Solo utente Admin All (controllo sempre lato server). */
export async function needAdmin(): Promise<Me | NextResponse> {
  const me = await needUser();
  if (isErr(me)) return me;
  return me.role === 'ADMIN' ? me : fail('Riservato ad Admin All', 403);
}

/**
 * Per gli script di verifica settimanale: oltre alla sessione Admin All accetta
 * "Authorization: Bearer <BACKUP_TOKEN>" se la variabile d'ambiente BACKUP_TOKEN (min 24 caratteri) e impostata.
 * Il token vale solo per le route che usano questa funzione (backup in sola lettura).
 */
export async function needAdminOrToken(req: Request): Promise<Me | NextResponse> {
  const tok = process.env.BACKUP_TOKEN;
  const h = req.headers.get('authorization') ?? '';
  if (tok && tok.length >= 24 && h.startsWith('Bearer ')) {
    const a = Buffer.from(h.slice(7));
    const b = Buffer.from(tok);
    if (a.length === b.length && timingSafeEqual(a, b)) return { username: 'backup-token', role: 'ADMIN', name: 'Backup token' };
    return fail('Token non valido', 401);
  }
  return needAdmin();
}

export async function audit(me: Me, action: string, entity: string, entityId: string | null, detail: any = null) {
  try {
    await q('insert into audit_log (user_name, action, entity, entity_id, detail) values ($1,$2,$3,$4,$5)', [
      me.username, action, entity, entityId, detail ? JSON.stringify(detail) : null,
    ]);
  } catch {}
}
