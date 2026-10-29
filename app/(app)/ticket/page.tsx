'use client';
import { useState } from 'react';
import { useApp } from '@/components/AppShell';
import ItemTable from '@/components/ItemTable';
import Modal from '@/components/Modal';
import { Ic } from '@/components/icons';
import { api } from '@/lib/client';

export default function Ticket() {
  const { me, reload, toast } = useApp();
  const [paste, setPaste] = useState(false);
  const [txt, setTxt] = useState('');
  const [err, setErr] = useState('');
  const [csv, setCsv] = useState('');
  const [csvName, setCsvName] = useState('');
  const [csvSummary, setCsvSummary] = useState<number | null>(null);
  const [csvOpen, setCsvOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  async function selectCsv(file?: File) {
    setCsvSummary(null); setErr('');
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { setErr('File troppo grande (max 4 MB)'); return; }
    try {
      const data = await file.text();
      const r = await api<{ summary: { ams: number } }>('/api/import', 'POST', { json: data, format: 'jira-csv', dryRun: true });
      setCsv(data); setCsvName(file.name); setCsvSummary(r.summary.ams);
    } catch (e: any) { setErr(e.message); }
  }
  async function importCsv() {
    if (!csvSummary || busy) return;
    setBusy(true); setErr('');
    try {
      const r = await api<{ imported: { items: number } }>('/api/import', 'POST', { json: csv, format: 'jira-csv' });
      await reload(); toast(`${r.imported.items} ticket AMS importati`); setCsvOpen(false); setCsv(''); setCsvSummary(null);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  // una riga per ticket: "AC-1234 - Subject (stato)" oppure "AC-1234<TAB>Subject<TAB>Owner"
  function parse() {
    return txt.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      const t = l.split('\t');
      if (t.length >= 2) return { area: 'AMS', code: t[0].trim(), description: t[1].trim(), owner: t[2]?.trim() ?? '', priority: t[3]?.trim() ?? '', requested_date: t[4]?.trim() ?? '' };
      const m = l.match(/^([A-Za-z]{1,6}-\d+)\s*[-–—:]\s*(.*)$/);
      let body = (m ? m[2] : l).replace(/\*\*/g, '');
      let activity = '', status = 'ontrack';
      const t2 = body.match(/\(([^()]*)\)\s*$/);
      if (t2) {
        activity = t2[1].trim(); body = body.slice(0, t2.index).trim();
        const x = activity.toLowerCase();
        status = /done|complet|chius|closed/.test(x) ? 'completed' : /hold/.test(x) ? 'onhold' : /block/.test(x) ? 'blocked' : /attesa|delay|wait/.test(x) ? 'delay' : 'ontrack';
      }
      return { area: 'AMS', code: m ? m[1] : '', description: body, priority: '', activity, status };
    });
  }
  const list = txt.trim() ? parse() : [];
  async function go() {
    try { await api('/api/items', 'POST', { items: list }); await reload(); toast(`${list.length} ticket aggiunti`); setPaste(false); setTxt(''); }
    catch (e: any) { setErr(e.message); }
  }
  return (
    <>
      <div className="top"><h2>Ticket AMS</h2><span className="sp" />
        {me.role === 'SC' && <><button className="btn" onClick={() => { setCsvOpen(true); setErr(''); }}><Ic n="up" />Importa CSV Jira</button><button className="btn" onClick={() => setPaste(true)}><Ic n="cp" />Incolla elenco</button></>}</div>
      <div className="body"><ItemTable area="AMS" prefix="AC" label="ticket" />
        <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>Un ticket con testo &quot;(done)&quot; a fine subject, o con Activity status Completed, passa in Archivio (Completed Activities).</div></div>
      {csvOpen && (
        <Modal title="Importa ticket da CSV Jira" onClose={() => setCsvOpen(false)} width={680}
          footer={<><span className="sp" />{err && <span className="err">{err}</span>}<button className="btn" onClick={() => setCsvOpen(false)}>Annulla</button>
            <button className="btn pri" disabled={!csvSummary || busy} onClick={importCsv}>{busy ? 'Importo…' : `Importa ${csvSummary ?? ''} ticket`}</button></>}>
          <p className="muted">Esporta da Jira un CSV con <b>Issue key</b> e <b>Summary</b>. Facoltativi: Assignee, Priority, Status, Created. I ticket già presenti (stessa Issue key) vengono saltati; non si modificano gli esistenti.</p>
          <input type="file" accept=".csv,text/csv" onChange={(e) => selectCsv(e.target.files?.[0])} />
          {csvSummary !== null && <p><b>{csvSummary} ticket</b> letti da {csvName}. Quelli con stato Done/Closed/Resolved verranno archiviati.</p>}
        </Modal>
      )}
      {paste && (
        <Modal title="Incolla elenco ticket" onClose={() => setPaste(false)} width={680}
          footer={<><span className="sp" />{err && <span className="err">{err}</span>}<button className="btn" onClick={() => setPaste(false)}>Annulla</button>
            <button className="btn pri" disabled={!list.length} onClick={go}>Aggiungi {list.length || ''} ticket</button></>}>
          <p className="muted" style={{ marginTop: 0 }}>Un ticket per riga. Formati: <code>AC-1234 - Subject (done)</code> oppure colonne separate da tab (Codice, Subject, Owner, Priorità, Opened) copiate da Excel.</p>
          <textarea style={{ height: 220 }} value={txt} onChange={(e) => setTxt(e.target.value)} placeholder={'AC-4821 - Errore creazione case da email\nAC-4837 - Macro agent console (done)'} />
        </Modal>
      )}
    </>
  );
}
