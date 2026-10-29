import { areasFor, type Area } from '@/lib/constants';
import { q } from '@/lib/db';
import { audit, fail, isErr, json, needUser } from '@/lib/http';
import { cleanItem } from '@/lib/items';
import { currentDeck } from '@/lib/state';

export async function POST(req: Request) {
  const me = await needUser();
  if (isErr(me)) return me;
  const b = await req.json().catch(() => null);
  const list: any[] = Array.isArray(b?.items) ? b.items : b ? [b] : [];
  if (!list.length) return fail('Nessun dato');
  const deck = await currentDeck();
  const created: string[] = [];
  for (const raw of list) {
    const area = raw.area as Area;
    if (!areasFor(me.role).includes(area)) return fail('Non puoi modificare quest\'area', 403);
    const c = cleanItem(area, raw);
    const pos = await q<{ m: number }>('select coalesce(max(position),0)::int + 1 as m from items where deck_id=$1 and area=$2', [deck.id, area]);
    const done = c.status === 'completed';
    const r = await q<{ id: string }>(
      `insert into items (deck_id, area, position, code, type, description, priority, requested_date, golive_date, owner, estimate, contract, activity, status, archived_at, closed_at, updated_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, ${done ? 'now()' : 'null'}, ${done ? 'now()' : 'null'}, $15) returning id`,
      [deck.id, area, pos[0].m, c.code ?? '', c.type ?? '', c.description ?? '', c.priority ?? '', c.requested_date ?? '', c.golive_date ?? '',
        c.owner ?? '', c.estimate ?? '', c.contract ?? '', c.activity ?? '', c.status ?? 'ontrack', me.username]
    );
    created.push(r[0].id);
  }
  await audit(me, 'create', 'item', created.join(','), { n: created.length });
  return json({ ok: true, ids: created });
}
