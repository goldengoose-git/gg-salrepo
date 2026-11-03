import { q } from './db';

// Tabelle ripristinabili dal backup JSON ("Backup completo"): chiave nel file -> tabella e chiave primaria
type Def = { table: string; pk: readonly string[]; deck?: 'required' | 'optional' };
export const RESTORE_TABLES: Record<'decks' | 'lookups' | 'settings' | 'items' | 'bars' | 'snapshots', Def> = {
  decks: { table: 'decks', pk: ['id'] },
  lookups: { table: 'lookups', pk: ['kind', 'value'] },
  settings: { table: 'settings', pk: ['key'] },
  items: { table: 'items', pk: ['id'], deck: 'required' },
  bars: { table: 'pipeline_bars', pk: ['id'], deck: 'required' },
  snapshots: { table: 'snapshots', pk: ['id'], deck: 'optional' },
};
export type RestoreKey = keyof typeof RESTORE_TABLES;
export const RESTORE_ORDER: RestoreKey[] = ['decks', 'lookups', 'settings', 'items', 'bars', 'snapshots'];

const qi = (s: string) => '"' + s.replace(/"/g, '""') + '"';

/**
 * Ripristina un blocco di righe del backup.
 * - Senza `overwrite`: inserisce solo le righe mancanti (stessa chiave = già presente, non si tocca).
 * - Con `overwrite`: le righe già presenti riprendono i valori del backup.
 * Non cancella mai nulla. I nomi di colonna sono ammessi solo se esistono nella tabella.
 */
export async function restoreRows(key: RestoreKey, rows: any[], opts: { overwrite?: boolean; dryRun?: boolean }) {
  const def = RESTORE_TABLES[key];
  if (!def) throw new Error('Tabella non valida');
  if (!Array.isArray(rows) || !rows.length) return { total: 0, existing: 0, missing: 0, applied: 0, skipped: 0 };
  const colRows = await q<{ column_name: string }>(`select column_name from information_schema.columns where table_schema = 'public' and table_name = $1`, [def.table]);
  const known = new Set(colRows.map((c) => c.column_name));
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r ?? {})))].filter((k) => known.has(k));
  for (const k of def.pk) if (!keys.includes(k)) throw new Error(`Nel backup mancano le righe con "${k}" (${key})`);
  const T = qi(def.table);
  const cols = keys.map(qi).join(', ');
  const json = JSON.stringify(rows);
  const same = def.pk.map((k) => `x.${qi(k)} = r.${qi(k)}`).join(' and ');
  const hasDeck = !!def.deck;
  // righe il cui settimana (deck) non esiste: non si possono inserire (le "snapshots" perdono solo il collegamento)
  const deckOk = `exists (select 1 from decks d where d.id = r."deck_id")`;
  const filter = def.deck === 'required' ? `where ${deckOk}` : '';
  const sel = keys.map((k) => (k === 'deck_id' && def.deck === 'optional' ? `case when ${deckOk} then r."deck_id" end` : `r.${qi(k)}`)).join(', ');
  const src = `jsonb_populate_recordset(null::${T}, $1::jsonb) r`;

  const ex = await q<{ existing: number; total: number; ok: number }>(
    `select count(*)::int as total, count(*) filter (where exists (select 1 from ${T} x where ${same}))::int as existing,
            count(*) filter (where ${hasDeck && def.deck === 'required' ? deckOk : 'true'})::int as ok from ${src}`, [json]);
  const total = ex[0].total, existing = ex[0].existing, skipped = total - ex[0].ok;
  const out = { total, existing, missing: total - existing, applied: 0, skipped };
  if (opts.dryRun) return out;

  const target = def.pk.map(qi).join(', ');
  const upd = keys.filter((k) => !def.pk.includes(k));
  const conflict = opts.overwrite && upd.length ? `do update set ${upd.map((k) => `${qi(k)} = excluded.${qi(k)}`).join(', ')}` : 'do nothing';
  const r = await q<{ n: number }>(
    `with ins as (insert into ${T} (${cols}) select ${sel} from ${src} ${filter} on conflict (${target}) ${conflict} returning 1)
     select count(*)::int as n from ins`, [json]);
  out.applied = r[0].n;
  return out;
}
