import { audit, fail, isErr, json, needUser } from '@/lib/http';
import { RESTORE_TABLES, restoreRows, type RestoreKey } from '@/lib/restore';

// POST { table, rows, overwrite?, dryRun? } — ripristino a blocchi dal "Backup completo" (formato sal-builder-backup).
// Aggiunge soltanto (o riporta i valori del backup con overwrite): non cancella mai nulla.
export async function POST(req: Request) {
  const me = await needUser();
  if (isErr(me)) return me;
  const b = await req.json().catch(() => null);
  const key = b?.table as RestoreKey;
  if (!key || !(key in RESTORE_TABLES)) return fail('Tabella non valida');
  if (!Array.isArray(b.rows) || b.rows.length > 1000) return fail('Blocco di righe non valido');
  try {
    const r = await restoreRows(key, b.rows, { overwrite: !!b.overwrite, dryRun: !!b.dryRun });
    if (!b.dryRun && r.applied) await audit(me, 'restore-backup', key, null, { applied: r.applied, overwrite: !!b.overwrite });
    return json({ ok: true, ...r });
  } catch (e: any) {
    return fail(e.message || 'Ripristino non riuscito', 400);
  }
}
