import { LANES, lanesFor, type Lane } from '@/lib/constants';
import { cleanBar, freeRow } from '@/lib/bars';
import { q } from '@/lib/db';
import { audit, fail, isErr, json, needUser } from '@/lib/http';
import { currentDeck } from '@/lib/state';

export async function POST(req: Request) {
  const me = await needUser();
  if (isErr(me)) return me;
  const b = await req.json().catch(() => ({}));
  const lane = b.lane as Lane;
  if (!LANES.includes(lane) || !lanesFor(me.role).includes(lane)) return fail('Non puoi modificare questa lane', 403);
  const deck = await currentDeck();
  const c = cleanBar(b);
  const others = await q<any>('select row, start_m::float as start_m, end_m::float as end_m from pipeline_bars where deck_id=$1 and lane=$2', [deck.id, lane]);
  const row = freeRow(others.map((o: any) => ({ row: +o.row, start_m: +o.start_m, end_m: +o.end_m })), c.start_m, c.end_m);
  const r = await q<{ id: string }>(
    `insert into pipeline_bars (deck_id, lane, label, status, start_m, end_m, row, updated_by) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
    [deck.id, lane, c.label, c.status, c.start_m, c.end_m, row, me.username]
  );
  await audit(me, 'create', 'bar', r[0].id);
  return json({ ok: true, id: r[0].id });
}
