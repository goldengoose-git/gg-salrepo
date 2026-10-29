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

export async function audit(me: Me, action: string, entity: string, entityId: string | null, detail: any = null) {
  try {
    await q('insert into audit_log (user_name, action, entity, entity_id, detail) values ($1,$2,$3,$4,$5)', [
      me.username, action, entity, entityId, detail ? JSON.stringify(detail) : null,
    ]);
  } catch {}
}
