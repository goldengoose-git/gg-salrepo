import { areasFor, type Area } from '@/lib/constants';
import { q } from '@/lib/db';
import { audit, fail, isErr, json, needUser } from '@/lib/http';
import { cleanItem, TXT } from '@/lib/items';

type Ctx = { params: Promise<{ id: string }> };

async function load(id: string) {
  const r = await q<any>('select * from items where id = $1', [id]);
  return r[0] as { id: string; deck_id: string; area: Area; position: number; status: string; archived_at: string | null } | undefined;
}

export async function PATCH(req: Request, { params }: Ctx) {
  const me = await needUser();
  if (isErr(me)) return me;
  const { id } = await params;
  const it = await load(id);
  if (!it) return fail('Non trovato', 404);
  if (!areasFor(me.role).includes(it.area)) return fail('Non puoi modificare quest\'area', 403);
  const b = await req.json().catch(() => ({}));

  // spostamento su/giù
  if (b.move === 'up' || b.move === 'down') {
    const cmp = b.move === 'up' ? '<' : '>';
    const ord = b.move === 'up' ? 'desc' : 'asc';
    const nb = await q<any>(
      `select id, position from items where deck_id=$1 and area=$2 and archived_at is null and position ${cmp} $3 order by position ${ord} limit 1`,
      [it.deck_id, it.area, it.position]
    );
    if (nb[0]) {
      await q('update items set position = $1 where id = $2', [nb[0].position, it.id]);
      await q('update items set position = $1 where id = $2', [it.position, nb[0].id]);
    }
    return json({ ok: true });
  }
  // ripristino dall'archivio
  if (b.restore) {
    const pos = await q<{ m: number }>('select coalesce(max(position),0)::int + 1 as m from items where deck_id=$1 and area=$2', [it.deck_id, it.area]);
    await q(`update items set status='ontrack', archived_at=null, closed_at=null, position=$1, updated_by=$2, updated_at=now() where id=$3`, [pos[0].m, me.username, id]);
    await audit(me, 'restore', 'item', id);
    return json({ ok: true });
  }

  const c = cleanItem(it.area, b);
  const sets: string[] = [];
  const vals: any[] = [];
  for (const k of TXT) if (c[k] !== undefined) { vals.push(c[k]); sets.push(`${k} = $${vals.length}`); }
  if (c.status) {
    vals.push(c.status); sets.push(`status = $${vals.length}`);
    if (c.status === 'completed') sets.push('archived_at = coalesce(archived_at, now())', 'closed_at = coalesce(closed_at, now())');
    else sets.push('archived_at = null', 'closed_at = null');
  }
  if (!sets.length) return fail('Nessuna modifica');
  vals.push(me.username); sets.push(`updated_by = $${vals.length}`, 'updated_at = now()');
  vals.push(id);
  await q(`update items set ${sets.join(', ')} where id = $${vals.length}`, vals);
  await audit(me, 'update', 'item', id, c);
  return json({ ok: true });
}

export async function DELETE(_: Request, { params }: Ctx) {
  const me = await needUser();
  if (isErr(me)) return me;
  const { id } = await params;
  const it = await load(id);
  if (!it) return fail('Non trovato', 404);
  if (!areasFor(me.role).includes(it.area)) return fail('Non puoi modificare quest\'area', 403);
  await q('delete from items where id = $1', [id]);
  await audit(me, 'delete', 'item', id);
  return json({ ok: true });
}
