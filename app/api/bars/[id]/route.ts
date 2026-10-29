import { LANES, lanesFor, type Lane } from '@/lib/constants';
import { q } from '@/lib/db';
import { audit, fail, isErr, json, needUser } from '@/lib/http';
import { cleanBar, freeRow } from '@/lib/bars';

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
  // se cambiano lane o date e la riga attuale si sovrappone ad un'altra barra, sposta sulla prima riga libera
  let row = +cur.row || 0;
  const others = (await q<any>('select row, start_m::float as start_m, end_m::float as end_m from pipeline_bars where deck_id=$1 and lane=$2 and id<>$3', [cur.deck_id, lane, id]))
    .map((o: any) => ({ row: +o.row, start_m: +o.start_m, end_m: +o.end_m }));
  if (lane !== cur.lane || others.some((o) => o.row === row && o.start_m < c.end_m + 0.04 && c.start_m < o.end_m + 0.04)) row = freeRow(others, c.start_m, c.end_m);
  await q('update pipeline_bars set lane=$1, label=$2, status=$3, start_m=$4, end_m=$5, row=$6, updated_by=$7, updated_at=now() where id=$8',
    [lane, c.label, c.status, c.start_m, c.end_m, row, me.username, id]);
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
