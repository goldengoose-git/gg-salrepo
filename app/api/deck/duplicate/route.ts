import { q } from '@/lib/db';
import { audit, fail, isErr, json, needUser } from '@/lib/http';
import { currentDeck } from '@/lib/state';
import { exportConfigured } from '@/lib/remote-export';
import { addDays, formatSalDate, isIso, weekLabel } from '@/lib/dates';

// Nuova settimana: copia impostazioni, tutte le righe (attive e in archivio) e timeline.
export async function POST(req: Request) {
  const me = await needUser();
  if (isErr(me)) return me;
  const b = await req.json().catch(() => ({}));
  const cur = await currentDeck();
  // con l'export remoto attivo la settimana va prima pubblicata (PPTX salvato su SharePoint); solo Admin All puo forzare
  if (exportConfigured() && cur.export_status !== 'ok' && !(b.force === true && me.role === 'ADMIN'))
    return fail('Prima pubblica la settimana: il PPTX non risulta ancora esportato su SharePoint', 409);
  // data SAL della nuova settimana (default: una settimana dopo); Week e data in cover derivano da qui
  const salDate = isIso(b.sal_date) ? b.sal_date : addDays(cur.sal_date && isIso(cur.sal_date) ? cur.sal_date : new Date().toISOString().slice(0, 10), 7);
  const label = weekLabel(salDate);
  const date = formatSalDate(salDate);
  const nd = await q<{ id: string }>(
    `insert into decks (week_label, client, subtitle, date_label, year, sal_date, logo_left_url, logo_right_url, bg_cover_url, bg_divider_url, bg_table_url, overlay)
     select $1, client, subtitle, $2, $4, $5, logo_left_url, logo_right_url, bg_cover_url, bg_divider_url, bg_table_url, overlay from decks where id = $3 returning id`,
    [label, date, cur.id, +salDate.slice(0, 4), salDate]
  );
  const id = nd[0].id;
  await q(
    `insert into items (deck_id, area, position, code, type, description, priority, requested_date, golive_date, release_date, owner, estimate, contract, activity, status, ams_status, archived_at, closed_at, updated_by)
     select $1, area, position, code, type, description, priority, requested_date, golive_date, release_date, owner, estimate, contract, activity, status, ams_status,
            case when status = 'completed' then coalesce(archived_at, now()) else archived_at end,
            case when status = 'completed' then coalesce(closed_at, now()) else closed_at end, $3
     from items where deck_id = $2`,
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
