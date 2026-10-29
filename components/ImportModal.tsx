'use client';
import { useRef, useState } from 'react';
import { api } from '@/lib/client';
import { useApp } from './AppShell';
import Modal from './Modal';
import { Ic } from './icons';

export default function ImportModal({ onClose }: { onClose: () => void }) {
  const { me, reload, toast } = useApp();
  const [text, setText] = useState('');
  const [scope, setScope] = useState<'all' | 'mine' | 'timeline'>('all');
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [meta, setMeta] = useState(false);
  const [sum, setSum] = useState<any>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  async function check(t: string) {
    setText(t); setSum(null); setErr('');
    if (!t.trim()) return;
    try { setSum((await api('/api/import', 'POST', { json: t, dryRun: true })).summary); } catch (e: any) { setErr(e.message); }
  }
  async function readFile(f?: File) { if (f) await check(await f.text()); }
  async function run() {
    setBusy(true); setErr('');
    try {
      const r = await api('/api/import', 'POST', { json: text, scope, mode, applyMeta: meta });
      await reload(); toast(`Importate ${r.imported.items} voci e ${r.imported.bars} barre`); onClose();
    } catch (e: any) { setErr(e.message); setBusy(false); }
  }
  const Opt = (v: string, t: string, d: string, cur: string, on: () => void) => (
    <button type="button" onClick={on} style={{ flex: 1, textAlign: 'left', padding: 12, borderRadius: 10, color: 'var(--fgb)', background: cur === v ? 'var(--sel)' : 'var(--panel)', border: cur === v ? '2px solid #E0301E' : '1px solid var(--line2)' }}>
      <b>{t}</b><div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>{d}</div>
    </button>
  );
  return (
    <Modal title="Importa JSON" onClose={onClose} width={780}
      footer={<><a className="btn" href="/api/export/json"><Ic n="dl" />Esporta JSON attuale</a><span className="sp" />{err && <span className="err">{err}</span>}
        <button className="btn" onClick={onClose}>Annulla</button><button className="btn pri" disabled={!sum || busy} onClick={run}>{busy ? 'Importo…' : 'Importa'}</button></>}>
      <div className="grid">
        <div className="drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); readFile(e.dataTransfer.files[0]); }}>
          <Ic n="up" /><b style={{ color: 'var(--fg)' }}>Trascina qui il file .json</b>
          <span>Accetta i deck esportati dal tool locale (Golden_Goose_SAL_deck) e gli export di questa app</span>
          <button className="btn" onClick={() => ref.current?.click()}>Scegli file</button>
          <input ref={ref} type="file" accept=".json,application/json" hidden onChange={(e) => readFile(e.target.files?.[0])} />
        </div>
        <div className="f"><label className="lab">Oppure incolla il JSON</label>
          <textarea style={{ height: 90, fontFamily: 'ui-monospace,monospace', fontSize: 12 }} value={text} onChange={(e) => check(e.target.value)} /></div>
        {sum && <div className="card" style={{ padding: 14, background: 'var(--bg)' }}>
          <div className="lab" style={{ marginBottom: 8 }}>Nel file</div>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}><span><b>{sum.mc}</b> azioni MC</span><span><b>{sum.sc}</b> azioni SC</span><span><b>{sum.ams}</b> ticket AMS</span><span><b>{sum.archived}</b> in archivio</span><span><b>{sum.bars}</b> barre timeline</span></div>
          <div className="muted" style={{ marginTop: 8, fontSize: 12.5 }}>Come {me.role} verranno importate solo le voci della tua area ({me.role === 'MC' ? 'MC; lane SFMC e CROSS' : 'SC e AMS; lane SFSC'}).</div>
        </div>}
        <div className="f"><label className="lab">Cosa importare</label><div style={{ display: 'flex', gap: 10 }}>
          {Opt('all', 'Voci e timeline', 'Tutto ciò che è tuo', scope, () => setScope('all'))}
          {Opt('mine', 'Solo voci', 'Senza timeline', scope, () => setScope('mine'))}
          {Opt('timeline', 'Solo timeline', 'Senza voci', scope, () => setScope('timeline'))}</div></div>
        <div className="f"><label className="lab">Modalità</label><div style={{ display: 'flex', gap: 10 }}>
          {Opt('merge', 'Unisci', 'Aggiunge alle righe esistenti', mode, () => setMode('merge'))}
          {Opt('replace', 'Sostituisci', 'Cancella la tua area e importa', mode, () => setMode('replace'))}</div></div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={meta} onChange={(e) => setMeta(e.target.checked)} />Aggiorna anche cliente, sottotitolo e data della cover</label>
      </div>
    </Modal>
  );
}
