import { q } from './db';
import { buildPptx } from './pptx';
import type { AppState } from './types';

/** Export remoto attivo solo se e configurato il flusso Power Automate (SAL_EXPORT_URL). */
export const exportConfigured = () => !!process.env.SAL_EXPORT_URL;

const DEFAULT_FOLDER = 'Golden Goose/1 - PM/SAL/SAL CRM-Marketing {year}';

/**
 * Genera il PPTX (con Completed Activities in finestra) e lo invia al flusso Power Automate (trigger HTTP) che lo salva su SharePoint.
 * Il flusso DEVE chiudere con un'azione "Risposta" (200) dopo "Crea file": senza, Power Automate risponde 202 subito
 * e un errore di salvataggio non sarebbe visibile. Se il file esiste gia (ri-export) il nome riceve un suffisso data-ora.
 */
export async function exportDeckRemote(st: AppState): Promise<{ url: string | null; fileName: string }> {
  const url = process.env.SAL_EXPORT_URL;
  if (!url) throw new Error('SAL_EXPORT_URL non configurato');
  const d = st.deck;
  const buf = await buildPptx(st, true);
  const sal = d.sal_date || new Date().toISOString().slice(0, 10);
  const re = d.export_status === 'ok' ? '_r' + new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-') : '';
  const fileName = `GG_Weekly_SAL_${d.week_label.replace(/\W+/g, '_')}_${sal}${re}.pptx`;
  const folderPath = (process.env.SAL_EXPORT_FOLDER || DEFAULT_FOLDER).replace('{year}', String(d.year));
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 45000);
  try {
    const res = await fetch(url, {
      method: 'POST', signal: ac.signal,
      headers: { 'content-type': 'application/json', ...(process.env.SAL_EXPORT_SECRET ? { 'x-sal-secret': process.env.SAL_EXPORT_SECRET } : {}) },
      body: JSON.stringify({ fileName, folderPath, week: d.week_label, salDate: sal, contentBase64: buf.toString('base64') }),
    });
    if (res.status === 202) throw new Error('il flusso risponde 202 senza attendere il salvataggio: aggiungi l\'azione "Risposta" dopo "Crea file"');
    if (!res.ok) throw new Error(`il flusso ha risposto ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
    const j: any = await res.json().catch(() => ({}));
    return { url: typeof j?.webUrl === 'string' ? j.webUrl : null, fileName };
  } catch (e: any) {
    throw new Error(e?.name === 'AbortError' ? 'timeout (45 s) nella chiamata al flusso' : String(e?.message ?? e));
  } finally { clearTimeout(timer); }
}

export async function saveExportResult(deckId: string, r: { url: string | null } | { error: string }) {
  if ('error' in r) await q(`update decks set export_status='error', export_error=$2 where id=$1`, [deckId, r.error.slice(0, 500)]);
  else await q(`update decks set export_status='ok', export_at=now(), export_url=$2, export_error=null where id=$1`, [deckId, r.url]);
}
