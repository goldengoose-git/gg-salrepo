import { q } from '@/lib/db';
import { audit, fail, isErr, json, needUser } from '@/lib/http';
import { getState } from '@/lib/state';
import { exportConfigured, exportDeckRemote, saveExportResult } from '@/lib/remote-export';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Pubblica settimana: export PPTX su SharePoint (se configurato), poi snapshot. Se l'export fallisce la pubblicazione non si completa.
export async function POST() {
  const me = await needUser();
  if (isErr(me)) return me;
  const st = await getState();
  let exported: string | null = null;
  if (exportConfigured()) {
    try {
      const r = await exportDeckRemote(st);
      await saveExportResult(st.deck.id, r);
      exported = r.fileName;
      await audit(me, 'export-remote', 'deck', st.deck.id, { file: r.fileName, url: r.url });
    } catch (e: any) {
      await saveExportResult(st.deck.id, { error: e.message }).catch(() => {});
      await audit(me, 'export-remote-fail', 'deck', st.deck.id, { error: e.message }).catch(() => {});
      return fail(`Export su SharePoint non riuscito: ${e.message}. Settimana NON pubblicata.`, 502);
    }
  }
  const { snapshots, ...payload } = st;
  await q('insert into snapshots (deck_id, week_label, payload, created_by) values ($1,$2,$3,$4)', [st.deck.id, st.deck.week_label, JSON.stringify(payload), me.username]);
  await q(`update decks set status='published', published_at=now() where id=$1`, [st.deck.id]);
  await audit(me, 'publish', 'deck', st.deck.id);
  return json({ ok: true, exported });
}
