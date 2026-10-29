import { q } from '@/lib/db';
import { audit, fail, isErr, json, needUser } from '@/lib/http';
import { canManage } from '@/lib/lookups-server';

export async function POST(req: Request) {
  const me = await needUser();
  if (isErr(me)) return me;
  const b = await req.json().catch(() => ({}));
  const kind = String(b.kind ?? '');
  const value = String(b.value ?? '').trim().slice(0, 80);
  if (!['type_mc', 'type_sc', 'owner', 'contract_label'].includes(kind)) return fail('Elenco non valido');
  if (!value) return fail('Inserisci un valore');
  if (!canManage(me.role, kind)) return fail('Non puoi modificare questo elenco', 403);
  const pos = await q<{ m: number }>('select coalesce(max(position),0)::int + 1 as m from lookups where kind=$1', [kind]);
  await q('insert into lookups (kind, value, position) values ($1,$2,$3) on conflict (kind, value) do nothing', [kind, value, pos[0].m]);
  await audit(me, 'create', 'lookup', null, { kind, value });
  return json({ ok: true });
}
