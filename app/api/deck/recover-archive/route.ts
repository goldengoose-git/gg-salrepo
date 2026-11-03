import { areasFor } from '@/lib/constants';
import { q } from '@/lib/db';
import { audit, isErr, json, needUser } from '@/lib/http';
import { currentDeck } from '@/lib/state';

// Porta nella settimana corrente le voci archiviate presenti solo nelle settimane precedenti.
// Aggiunge soltanto: non modifica né cancella nulla. Le voci già presenti (stessa area, codice e descrizione) non si duplicano.
// ?dryRun=1 conta soltanto.
export async function POST(req: Request) {
  const me = await needUser();
  if (isErr(me)) return me;
  const dry = new URL(req.url).searchParams.get('dryRun') === '1';
  const deck = await currentDeck();
  const areas = areasFor(me.role);
  const src = `select distinct on (area, coalesce(code,''), description) *
       from items where archived_at is not null and deck_id <> $1 and area = any($2)
       order by area, coalesce(code,''), description, archived_at desc`;
  const missing = `from (${src}) old where not exists (
       select 1 from items x where x.deck_id = $1 and x.archived_at is not null and x.area = old.area
         and x.description = old.description and coalesce(x.code,'') = coalesce(old.code,''))`;
  if (dry) {
    const r = await q<{ n: number }>(`select count(*)::int as n ${missing}`, [deck.id, areas]);
    return json({ ok: true, recoverable: r[0].n });
  }
  const r = await q<{ id: string }>(
    `insert into items (deck_id, area, position, code, type, description, priority, requested_date, golive_date, release_date, owner, estimate, contract, activity, status, ams_status, archived_at, closed_at, updated_by)
     select $1, area, position, code, type, description, priority, requested_date, golive_date, release_date, owner, estimate, contract, activity, status, ams_status, archived_at, closed_at, $3
     ${missing} returning id`,
    [deck.id, areas, me.username]
  );
  await audit(me, 'recover-archive', 'deck', deck.id, { n: r.length });
  return json({ ok: true, recovered: r.length });
}
