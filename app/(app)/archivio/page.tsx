'use client';
import { useState } from 'react';
import { useApp } from '@/components/AppShell';
import { StatusPill } from '@/components/StatusPill';
import { Ic } from '@/components/icons';
import { areasFor } from '@/lib/constants';
import { api, download } from '@/lib/client';
import { Prio } from '@/lib/prio';

export default function Archivio() {
  const { me, state, reload, toast } = useApp();
  const own = me.role === 'MC' ? (['MC', 'SC', 'AMS'] as const) : (['SC', 'AMS', 'MC'] as const); // prima i sistemi del proprio team
  const [f, setF] = useState<'MC' | 'SC' | 'AMS'>(own[0]);
  const [q, setQ] = useState('');
  const all = state!.items.filter((i) => i.archived_at).sort((a, b) => +new Date(b.closed_at ?? b.archived_at!) - +new Date(a.closed_at ?? a.archived_at!));
  const rows = all.filter((i) => i.area === f && (!q || JSON.stringify(Object.values(i)).toLowerCase().includes(q.toLowerCase())));
  return (
    <>
      <div className="top"><h2>Archivio · Completed Activities</h2><span className="sp" />
        <button className="btn" onClick={() => download('/api/export/xlsx', 'archivio.xlsx').catch((e) => toast(e.message))}><Ic n="dl" />Esporta XLSX</button></div>
      <div className="body">
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
          <div style={{ width: 260 }}><input placeholder="Cerca nell'archivio" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          {own.map((a) => <button key={a} className={'chip' + (f === a ? ' on' : '')} onClick={() => setF(a)}>{a === 'MC' ? 'Marketing Cloud' : a === 'SC' ? 'Service Cloud' : 'Ticket AMS'}{areasFor(me.role).includes(a) ? ' (tuo)' : ''} {all.filter((i) => i.area === a).length}</button>)}
        </div>
        <div className="card" style={{ overflow: 'auto' }}>
          <table className="t">
            <thead><tr><th>Area</th><th>Ticket</th><th>Type</th><th>Description</th><th>Priorità</th><th>GoLive</th><th>Owner</th><th>Contract</th><th>Stato</th><th>Chiuso il</th><th /></tr></thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id}>
                  <td style={{ borderLeft: '4px solid #7135A8' }}><b>{i.area}</b></td><td>{i.code}</td><td>{i.type}</td><td style={{ minWidth: 240 }}>{i.description}</td>
                  <td><Prio p={i.priority} size={15} /></td><td>{i.golive_date}</td><td>{i.owner}</td><td>{i.contract}</td><td><StatusPill s={i.status} /></td>
                  <td>{(i.closed_at ?? i.archived_at ?? '').slice(0, 10)}</td>
                  <td>{areasFor(me.role).includes(i.area) && (
                    <button className="btn" style={{ height: 28 }} onClick={async () => { await api(`/api/items/${i.id}`, 'PATCH', { restore: true }); await reload(); toast('Ripristinato'); }}><Ic n="undo" />Ripristina</button>)}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={11} className="muted" style={{ padding: 24, textAlign: 'center' }}>Archivio vuoto.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="muted" style={{ marginTop: 12, fontSize: 13 }}>Le voci Done arrivano qui da sole. Nell&apos;export (opzionale) finiscono in pagine &quot;Completed Activities&quot;, 12 per slide, con striscia viola.</div>
      </div>
    </>
  );
}
