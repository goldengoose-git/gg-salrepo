import { areasFor, type Area } from '@/lib/constants';
import { q } from '@/lib/db';
import { fail, isErr, json, needUser } from '@/lib/http';
import { currentDeck } from '@/lib/state';

// POST { area, ids: [id, id, ...] } -> nuovo ordine (drag and drop)
export async function POST(req: Request) {
  const me = await needUser();
  if (isErr(me)) return me;
  const b = await req.json().catch(() => ({}));
  const area = b.area as Area;
  const ids: string[] = Array.isArray(b.ids) ? b.ids.map(String) : [];
  if (!areasFor(me.role).includes(area)) return fail('Non puoi modificare quest\'area', 403);
  if (!ids.length) return fail('Nessun dato');
  const deck = await currentDeck();
  const ok = await q<{ n: number }>(
    'select count(*)::int as n from items where deck_id=$1 and area=$2 and archived_at is null and id = any($3::uuid[])',
    [deck.id, area, ids]
  );
  if (ok[0].n !== ids.length) return fail('Elenco non valido, ricarica la pagina');
  await q(
    `update items i set position = x.pos, updated_by = $4, updated_at = now()
     from (select u.id::uuid as id, u.ord::int as pos from unnest($3::text[]) with ordinality as u(id, ord)) x
     where i.id = x.id and i.deck_id = $1 and i.area = $2`,
    [deck.id, area, ids, me.username]
  );
  return json({ ok: true });
}
