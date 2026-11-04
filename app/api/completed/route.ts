import { q } from '@/lib/db';
import { doneTime } from '@/lib/dates';
import { isErr, json, needUser } from '@/lib/http';
export const dynamic = 'force-dynamic';

// Voci completate negli ultimi N giorni, da TUTTE le settimane (storico), una riga per voce (area+codice+descrizione).
// Il riferimento e la GoLive date quando e una data (28/10, Beg Oct...), altrimenti la data di chiusura.
export async function GET(req: Request) {
  const me = await needUser();
  if (isErr(me)) return me;
  const days = Math.min(365, Math.max(1, Math.round(+(new URL(req.url).searchParams.get('days') ?? 14)) || 14));
  const all = await q<any>(
    `select distinct on (i.area, coalesce(i.code,''), i.description)
            i.area, i.code, i.description, i.owner, i.contract, i.golive_date,
            coalesce(i.closed_at, i.archived_at) as closed, d.week_label
     from items i join decks d on d.id = i.deck_id
     where i.status = 'completed'
     order by i.area, coalesce(i.code,''), i.description, coalesce(i.closed_at, i.archived_at) desc`
  );
  const now = new Date(), from = +now - days * 86400000;
  const rows = all
    .map((r: any) => ({ ...r, when: doneTime({ golive_date: r.golive_date, closed_at: r.closed }, now) }))
    .filter((r: any) => Number.isFinite(r.when) && r.when >= from)
    .sort((a: any, b: any) => b.when - a.when)
    .map(({ when, ...r }: any) => r);
  return json({ days, rows });
}
