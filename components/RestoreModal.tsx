'use client';
import { useRef, useState } from 'react';
import { api } from '@/lib/client';
import { useApp } from './AppShell';
import Modal from './Modal';
import { Ic } from './icons';

type Key = 'decks' | 'lookups' | 'settings' | 'items' | 'bars' | 'snapshots';
const ORDER: Key[] = ['decks', 'lookups', 'settings', 'items', 'bars', 'snapshots'];
const LABEL: Record<Key, string> = { decks: 'Settimane', lookups: 'Elenchi (Type, Owner, Contract)', settings: 'Impostazioni', items: 'Voci (MC, SC, AMS, anche archiviate)', bars: 'Barre della timeline', snapshots: 'Storico pubblicato' };

// blocchi piccoli: ogni richiesta resta sotto i limiti di Vercel
function chunks(rows: any[], maxRows = 300, maxBytes = 1_200_000) {
  const out: any[][] = []; let cur: any[] = []; let size = 0;
  for (const r of rows) {
    const s = JSON.stringify(r).length;
    if (cur.length && (cur.length >= maxRows || size + s > maxBytes)) { out.push(cur); cur = []; size = 0; }
    cur.push(r); size += s;
  }
  if (cur.length) out.push(cur);
  return out;
}

export default function RestoreModal({ onClose }: { onClose: () => void }) {
  const { reload, toast } = useApp();
  const ref = useRef<HTMLInputElement>(null);
  const [bk, setBk] = useState<any>(null);
  const [name, setName] = useState('');
  const [res, setRes] = useState<Record<string, { total: number; existing: number; missing: number }> | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  async function run(dry: boolean, data = bk) {
    const acc: Record<string, { total: number; existing: number; missing: number; applied: number }> = {};
    for (const k of ORDER) {
      const rows: any[] = Array.isArray(data?.[k]) ? data[k] : [];
      acc[k] = { total: 0, existing: 0, missing: 0, applied: 0 };
      for (const part of chunks(rows)) {
        setBusy(`${dry ? 'Controllo' : 'Ripristino'}: ${LABEL[k]}…`);
        const r = await api('/api/restore', 'POST', { table: k, rows: part, overwrite, dryRun: dry });
        acc[k].total += r.total; acc[k].existing += r.existing; acc[k].missing += r.missing; acc[k].applied += r.applied;
      }
    }
    return acc;
  }
  async function load(f?: File) {
    if (!f) return;
    setErr(''); setRes(null); setBk(null); setName(f.name);
    try {
      const j = JSON.parse((await f.text()).replace(/^﻿/, ''));
      if (j?.format !== 'sal-builder-backup') throw new Error('Non è un "Backup completo" di questa app (formato sal-builder-backup). Per un export di una singola settimana usa "Importa JSON / CSV".');
      setBk(j);
      setBusy('Controllo…'); setRes(await run(true, j));
    } catch (e: any) { setErr(e.message); }
    setBusy('');
  }
  async function go() {
    if (!bk) return;
    const n = ORDER.reduce((a, k) => a + (res?.[k]?.missing ?? 0), 0);
    if (!confirm(overwrite
      ? 'Ripristinare le righe mancanti E riportare ai valori del backup anche quelle già presenti? Le modifiche fatte dopo il backup sulle stesse righe andranno perse.'
      : `Ripristinare ${n} righe mancanti? Non viene modificato né cancellato nulla di ciò che c'è già.`)) return;
    setErr('');
    try {
      const r = await run(false);
      const tot = ORDER.reduce((a, k) => a + r[k].applied, 0);
      await reload(); toast(`Ripristinate ${tot} righe`); onClose();
    } catch (e: any) { setErr(e.message); }
    setBusy('');
  }
  const missing = res ? ORDER.reduce((a, k) => a + (res[k]?.missing ?? 0), 0) : 0;
  const existing = res ? ORDER.reduce((a, k) => a + (res[k]?.existing ?? 0), 0) : 0;
  return (
    <Modal title="Ripristina da backup" onClose={onClose} width={760}
      footer={<><span className="sp" />{busy && <span className="muted">{busy}</span>}{err && <span className="err">{err}</span>}
        <button className="btn" onClick={onClose} disabled={!!busy && !res}>Annulla</button>
        <button className="btn pri" disabled={!res || !!busy || (!overwrite && missing === 0) || (overwrite && missing + existing === 0)} onClick={go}>Ripristina</button></>}>
      <div className="grid">
        <div className="drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); load(e.dataTransfer.files[0]); }}>
          <Ic n="up" /><b style={{ color: 'var(--fg)' }}>{name || 'Trascina qui il file di backup (.json)'}</b>
          <span>Il file scaricato con &quot;Backup completo&quot;</span>
          <button className="btn" onClick={() => ref.current?.click()}>Scegli file</button>
          <input ref={ref} type="file" accept=".json,application/json" hidden onChange={(e) => load(e.target.files?.[0])} />
        </div>
        {bk && <div className="muted" style={{ fontSize: 12.5 }}>Backup del {String(bk.exported_at ?? '').slice(0, 16).replace('T', ' ')}</div>}
        {res && <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="t"><thead><tr><th>Cosa</th><th>Nel backup</th><th>Già presenti</th><th>Da ripristinare</th></tr></thead>
            <tbody>{ORDER.map((k) => <tr key={k}><td>{LABEL[k]}</td><td>{res[k].total}</td><td>{res[k].existing}</td><td><b>{res[k].missing}</b></td></tr>)}</tbody></table>
        </div>}
        {res && <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <input type="checkbox" style={{ marginTop: 3 }} checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
          <span>Riporta ai valori del backup anche le righe già presenti ({existing}).<br /><span className="muted" style={{ fontSize: 12.5 }}>Utile per annullare modifiche fatte per errore. Se lasci vuoto, vengono aggiunte solo le righe mancanti.</span></span>
        </label>}
        <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
          Il ripristino <b>non cancella mai nulla</b>: aggiunge le righe che mancano (settimane, voci, archivio, timeline, storico). Gli utenti e le password non fanno parte del backup. Le immagini non sono nel file: restano su Vercel Blob. Per tornare indietro su tutto, usa il branch di Neon.
        </div>
      </div>
    </Modal>
  );
}
