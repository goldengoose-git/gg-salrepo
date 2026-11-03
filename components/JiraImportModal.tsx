'use client';
import { useRef, useState } from 'react';
import { AMS_STATUS } from '@/lib/constants';
import { api, download } from '@/lib/client';
import { useApp } from './AppShell';
import Modal from './Modal';
import { Ic } from './icons';

type Summary = { jira: boolean; ams: number; existingAms: number; newDone: number; byAms: Record<string, number> };

/** Import CSV Jira sui Ticket AMS: stesso formato dell'export Jira (Issue key, Summary, Priority, Status, Created, Reporter...). */
export default function JiraImportModal({ onClose }: { onClose: () => void }) {
  const { reload, toast } = useApp();
  const ref = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [sum, setSum] = useState<Summary | null>(null);
  const [incDone, setIncDone] = useState(true);
  const [backup, setBackup] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function readFile(f?: File) {
    if (!f) return;
    setErr(''); setSum(null); setName(f.name);
    const t = await f.text();
    setText(t);
    try {
      const s = (await api<{ summary: Summary }>('/api/import', 'POST', { json: t, dryRun: true })).summary;
      if (!s.jira) throw new Error('Il file non sembra un export Jira: servono le colonne Issue key, Summary e Status.');
      setSum(s);
    } catch (e: any) { setErr(e.message); }
  }
  async function run() {
    setBusy(true); setErr('');
    try {
      if (backup) await download('/api/export/backup', 'SAL_backup_prima_import.json');
      const r = await api('/api/import', 'POST', { json: text, scope: 'mine', mode: 'merge', includeDone: incDone });
      await reload();
      toast(`Import Jira: ${r.imported.items} ticket aggiunti, ${r.imported.updated} aggiornati`);
      onClose();
    } catch (e: any) { setErr(e.message); setBusy(false); }
  }
  return (
    <Modal title="Importa CSV Jira" onClose={onClose} width={720}
      footer={<><span className="sp" />{err && <span className="err">{err}</span>}<button className="btn" onClick={onClose}>Annulla</button>
        <button className="btn pri" disabled={!sum || busy} onClick={run}>{busy ? 'Importo…' : `Importa ${sum?.ams ?? ''} ticket`}</button></>}>
      <div className="grid">
        <div className="drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); readFile(e.dataTransfer.files[0]); }}>
          <Ic n="up" /><b style={{ color: 'var(--fg)' }}>{name || 'Trascina qui il CSV esportato da Jira'}</b>
          <span>Colonne lette: Issue key, Summary, Priority, Status, Created, Reporter/Assignee</span>
          <button className="btn" onClick={() => ref.current?.click()}>{name ? 'Cambia file' : 'Scegli file'}</button>
          <input ref={ref} type="file" accept=".csv,text/csv" hidden onChange={(e) => readFile(e.target.files?.[0])} />
        </div>
        {sum && (
          <div className="card" style={{ padding: 14, background: 'var(--bg)', borderLeft: '4px solid #2F6FDE' }}>
            <b>Anteprima</b> · {sum.ams} ticket nel file <span className="muted">(nulla viene scritto finché non confermi)</span>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8, fontSize: 13.5 }}>
              {Object.entries(sum.byAms).map(([k, n]) => <span key={k}><b>{n}</b> {AMS_STATUS[k as keyof typeof AMS_STATUS]?.label ?? k}</span>)}
            </div>
            <div className="muted" style={{ marginTop: 8, fontSize: 12.5 }}>
              <b>{sum.existingAms}</b> già presenti: vengono <b>aggiornati</b> (stato, titolo, priorità, owner). <b>{sum.ams - sum.existingAms}</b> nuovi: aggiunti. I ticket non presenti nel file restano invariati.
              Jira «On Hold» diventa «Waiting for feedback».
            </div>
          </div>
        )}
        {sum && sum.newDone > 0 && (
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={incDone} onChange={(e) => setIncDone(e.target.checked)} />Aggiungi anche i {sum.newDone} ticket Done non ancora presenti, come storico in Archivio</label>
        )}
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={backup} onChange={(e) => setBackup(e.target.checked)} />Scarica un backup JSON prima di importare</label>
      </div>
    </Modal>
  );
}
