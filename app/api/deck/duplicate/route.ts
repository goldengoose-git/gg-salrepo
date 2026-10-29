import { q } from '@/lib/db';
import { audit, fail, isErr, json, needUser } from '@/lib/http';
import { currentDeck } from '@/lib/state';

// Nuova settimana: copia impostazioni, righe attive (non in archivio) e timeline.
export async function POST(req: Request) {
  const me = await needUser();
  if (isErr(me)) return me;
  const b = await req.json().catch(() => ({}));
  const label = String(b.week_label ?? '').trim();
  const date = String(b.date_label ?? '').trim();
  if (!label) return fail('Indica il nome della settimana');
  const cur = await currentDeck();
  const nd = await q<{ id: string }>(
    `insert into decks (week_label, client, subtitle, date_label, year, logo_left_url, logo_right_url, bg_cover_url, bg_divider_url, bg_table_url, overlay)
     select $1, client, subtitle, $2, year, logo_left_url, logo_right_url, bg_cover_url, bg_divider_url, bg_table_url, overlay from decks where id = $3 returning id`,
    [label, date || cur.date_label, cur.id]
  );
  const id = nd[0].id;
  await q(
    `insert into items (deck_id, area, position, code, type, description, priority, requested_date, golive_date, owner, estimate, contract, status, updated_by)
     select $1, area, position, code, type, description, priority, requested_date, golive_date, owner, estimate, contract, status, $3
     from items where deck_id = $2 and archived_at is null`,
    [id, cur.id, me.username]
  );
  await q(
    `insert into pipeline_bars (deck_id, lane, label, status, start_m, end_m, row, updated_by)
     select $1, lane, label, status, start_m, end_m, row, $3 from pipeline_bars where deck_id = $2`,
    [id, cur.id, me.username]
  );
  await audit(me, 'duplicate', 'deck', id, { from: cur.id });
  return json({ ok: true, id });
}
