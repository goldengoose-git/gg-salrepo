import { isErr, needUser } from '@/lib/http';
import { q } from '@/lib/db';

// Backup completo: tutte le settimane (voci, anche archiviate, e timeline), storico pubblicato, elenchi e impostazioni.
export async function GET() {
  const me = await needUser();
  if (isErr(me)) return me;
  const [decks, items, bars, snapshots, lookups, settings] = await Promise.all([
    q<any>('select * from decks order by created_at'),
    q<any>('select * from items order by deck_id, area, position'),
    q<any>('select * from pipeline_bars order by deck_id, lane, row, start_m'),
    q<any>('select * from snapshots order by created_at'),
    q<any>('select kind, value, position from lookups order by kind, position').catch(() => []),
    q<any>('select * from settings').catch(() => []),
  ]);
  const body = { format: 'sal-builder-backup', version: 1, exported_at: new Date().toISOString(), counts: { decks: decks.length, items: items.length, bars: bars.length, snapshots: snapshots.length }, decks, items, bars, snapshots, lookups, settings };
  return new Response(JSON.stringify(body, null, 1), {
    headers: { 'content-type': 'application/json', 'content-disposition': `attachment; filename="SAL_backup_completo_${new Date().toISOString().slice(0, 10)}.json"` },
  });
}
