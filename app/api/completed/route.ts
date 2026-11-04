import { q } from '@/lib/db';
import { isErr, json, needUser } from '@/lib/http';
export const dynamic = 'force-dynamic';

// Voci completate negli ultimi N giorni, da TUTTE le settimane (storico). Una riga per voce (area+codice+descrizione), la chiusura piu recente.
export async function GET(req: Request) {
  const me = await needUser();
  if (isErr(me)) return me;
  const days = Math.min(365, Math.max(1, Math.round(+(new URL(req.url).searchParams.get('days') ?? 14)) || 14));
  const rows = await q(
    `select distinct on (i.area, coalesce(i.code,''), i.description)
            i.area, i.code, i.type, i.description, i.priority, i.golive_date, i.owner, i.contract, i.ams_status,
            coalesce(i.closed_at, i.archived_at) as closed, d.week_label
     from items i join decks d on d.id = i.deck_id
     where i.status = 'completed' and coalesce(i.closed_at, i.archived_at) >= now() - make_interval(days => $1::int)
     order by i.area, coalesce(i.code,''), i.description, coalesce(i.closed_at, i.archived_at) desc`,
    [days]
  );
  rows.sort((a: any, b: any) => +new Date(b.closed) - +new Date(a.closed));
  return json({ days, rows });
}
