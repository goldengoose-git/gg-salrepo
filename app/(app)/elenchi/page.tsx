'use client';
import { useState } from 'react';
import { useApp } from '@/components/AppShell';
import { Ic } from '@/components/icons';
import { api } from '@/lib/client';
import { KINDS, type LookupKind } from '@/lib/lookups';

function Box({ kind, title, hint }: { kind: LookupKind; title: string; hint: string }) {
  const { me, state, reload, toast } = useApp();
  const [v, setV] = useState('');
  const [busy, setBusy] = useState(false);
  const can = kind === 'owner' || (kind === 'type_mc' && me.role === 'MC') || (kind === 'type_sc' && me.role === 'SC');
  const list = state!.lookups.filter((l) => l.kind === kind);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!v.trim()) return;
    setBusy(true);
    try { await api('/api/lookups', 'POST', { kind, value: v }); setV(''); await reload(); } catch (x: any) { toast(x.message); }
    setBusy(false);
  }
  async function del(id: string, value: string) {
    if (!confirm(`Togliere "${value}" dall'elenco? Le voci che lo usano restano invariate.`)) return;
    try { await api(`/api/lookups/${id}`, 'DELETE'); await reload(); } catch (x: any) { toast(x.message); }
  }
  return (
    <div className="card" style={{ padding: 20 }}>
      <div className="lab">{title}</div>
      <div className="muted" style={{ fontSize: 12.5, margin: '6px 0 14px' }}>{hint}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', minHeight: 34 }}>
        {list.map((l) => (
          <span key={l.id} className="opt" style={{ cursor: 'default', gap: 8 }}>{l.value}
            {can && <button title="Rimuovi" onClick={() => del(l.id, l.value)} style={{ background: 'none', border: 0, color: 'var(--mut)', padding: 0, display: 'inline-flex' }}><span style={{ width: 14, height: 14, display: 'inline-flex' }}><Ic n="x" /></span></button>}
          </span>
        ))}
        {!list.length && <span className="muted">Nessun valore.</span>}
      </div>
      {can
        ? <form onSubmit={add} style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <input value={v} onChange={(e) => setV(e.target.value)} placeholder={kind === 'owner' ? 'CRM: Nome oppure IT: Nome' : 'Nuovo valore'} maxLength={80} />
            <button className="btn pri" disabled={busy || !v.trim()} style={{ flex: 'none' }}><Ic n="plus" />Aggiungi</button>
          </form>
        : <div className="muted" style={{ marginTop: 14, fontSize: 13 }}>Sola lettura: lo gestisce l&apos;altro team.</div>}
    </div>
  );
}

export default function Elenchi() {
  return (
    <>
      <div className="top"><h2>Elenchi</h2><span className="muted">Valori selezionabili nelle modali delle azioni</span></div>
      <div className="body" style={{ display: 'grid', gap: 20, maxWidth: 900 }}>
        {KINDS.map((k) => <Box key={k.kind} {...k} />)}
        <div className="muted" style={{ fontSize: 13 }}>Togliere un valore dall&apos;elenco non modifica le azioni già salvate: il testo resta com&apos;è e compare comunque tra le opzioni quando riapri la voce.</div>
      </div>
    </>
  );
}
