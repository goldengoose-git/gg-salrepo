import { isErr, needUser } from '@/lib/http';
import { getState } from '@/lib/state';
import { CSV_COLS, toCsv } from '@/lib/csv';

// Tutte le voci della settimana corrente, anche archiviate. Reimportabile da "Importa".
export async function GET() {
  const me = await needUser();
  if (isErr(me)) return me;
  const st = await getState();
  const rows: any[][] = [[...CSV_COLS]];
  for (const i of st.items)
    rows.push([i.area, i.code, i.type, i.description, i.priority, i.requested_date, i.golive_date, i.release_date, i.owner, i.estimate, i.contract, i.activity, i.status, i.ams_status ?? '', i.archived_at ? 'sì' : '']);
  return new Response(toCsv(rows), {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="SAL_${st.deck.week_label.replace(/\W+/g, '_')}.csv"` },
  });
}
