import { q } from '@/lib/db';
import { audit, fail, isErr, json, needUser } from '@/lib/http';
import { canManage } from '@/lib/lookups-server';

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await needUser();
  if (isErr(me)) return me;
  const { id } = await params;
  const r = await q<{ kind: string; value: string }>('select kind, value from lookups where id = $1', [id]);
  if (!r[0]) return fail('Non trovato', 404);
  if (!canManage(me.role, r[0].kind)) return fail('Non puoi modificare questo elenco', 403);
  await q('delete from lookups where id = $1', [id]);
  await audit(me, 'delete', 'lookup', id, r[0]);
  return json({ ok: true });
}
