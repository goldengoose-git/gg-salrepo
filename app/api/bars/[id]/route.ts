import { LANES, lanesFor, type Lane } from '@/lib/constants';
import { q } from '@/lib/db';
import { audit, fail, isErr, json, needUser } from '@/lib/http';
import { cleanBar } from '@/lib/bars';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const me = await needUser();
  if (isErr(me)) return me;
  const { id } = await params;
  const cur = (await q<any>('select * from pipeline_bars where id=$1', [id]))[0];
  if (!cur) return fail('Non trovato', 404);
  if (!lanesFor(me.role).includes(cur.lane)) return fail('Non puoi modificare questa lane', 403);
  const b = await req.json().catch(() => ({}));
  let lane: Lane = cur.lane;
  if (b.lane && LANES.includes(b.lane)) {
    if (!lanesFor(me.role).includes(b.lane)) return fail('Lane non consentita', 403);
    lane = b.lane;
  }
  const c = cleanBar({ ...cur, ...b });
  await q('update pipeline_bars set lane=$1, label=$2, status=$3, start_m=$4, end_m=$5, updated_by=$6, updated_at=now() where id=$7',
    [lane, c.label, c.status, c.start_m, c.end_m, me.username, id]);
  await audit(me, 'update', 'bar', id);
  return json({ ok: true });
}

export async function DELETE(_: Request, { params }: Ctx) {
  const me = await needUser();
  if (isErr(me)) return me;
  const { id } = await params;
  const cur = (await q<any>('select lane from pipeline_bars where id=$1', [id]))[0];
  if (!cur) return fail('Non trovato', 404);
  if (!lanesFor(me.role).includes(cur.lane)) return fail('Non puoi modificare questa lane', 403);
  await q('delete from pipeline_bars where id=$1', [id]);
  await audit(me, 'delete', 'bar', id);
  return json({ ok: true });
}
