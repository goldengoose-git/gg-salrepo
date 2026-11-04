import { audit, fail, isErr, json, needAdmin } from '@/lib/http';
import { getState } from '@/lib/state';
import { exportConfigured, exportDeckRemote, saveExportResult } from '@/lib/remote-export';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Riesporta su SharePoint la settimana corrente (solo Admin All), ad esempio dopo un errore.
export async function POST() {
  const me = await needAdmin();
  if (isErr(me)) return me;
  if (!exportConfigured()) return fail('Export remoto non configurato (SAL_EXPORT_URL)', 400);
  const st = await getState();
  try {
    const r = await exportDeckRemote(st);
    await saveExportResult(st.deck.id, r);
    await audit(me, 'export-remote', 'deck', st.deck.id, { file: r.fileName, url: r.url, retry: true });
    return json({ ok: true, file: r.fileName });
  } catch (e: any) {
    await saveExportResult(st.deck.id, { error: e.message }).catch(() => {});
    await audit(me, 'export-remote-fail', 'deck', st.deck.id, { error: e.message }).catch(() => {});
    return fail(`Export su SharePoint non riuscito: ${e.message}`, 502);
  }
}
