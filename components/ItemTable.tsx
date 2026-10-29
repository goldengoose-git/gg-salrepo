'use client';
import { useState } from 'react';
import { areasFor, type Area } from '@/lib/constants';
import { api } from '@/lib/client';
import type { Item } from '@/lib/types';
import { useApp } from './AppShell';
import { Ic } from './icons';
import ItemModal from './ItemModal';
import { StatusPill } from './StatusPill';

export default function ItemTable({ area, prefix, label }: { area: Area; prefix: string; label: string }) {
  const { me, state, reload, toast } = useApp();
  const [edit, setEdit] = useState<Item | 'new' | null>(null);
  const [q, setQ] = useState('');
  const [fs, setFs] = useState('');
  const canEdit = areasFor(me.role).includes(area);
  const all = state!.items.filter((i) => i.area === area && !i.archived_at).sort((a, b) => a.position - b.position);
  const rows = all.filter((i) => (!fs || i.status === fs) && (!q || JSON.stringify(Object.values(i)).toLowerCase().includes(q.toLowerCase())));
  const ams = area === 'AMS';

  async function act(id: string, body: any, msg?: string) {
    try { await api(`/api/items/${id}`, 'PATCH', body); await reload(); if (msg) toast(msg); } catch (e: any) { toast(e.message); }
  }
  return (
    <>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ width: 260 }}><input placeholder="Cerca…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        {['', 'ontrack', 'delay', 'blocked', 'onhold'].map((s) => (
          <button key={s} className={'chip' + (fs === s ? ' on' : '')} onClick={() => setFs(s)}>{s ? s : 'Tutti'} {s ? all.filter((i) => i.status === s).length : all.length}</button>
        ))}
        <span className="sp" />
        {!canEdit && <span className="muted">Sola lettura: area dell&apos;altro team</span>}
        {canEdit && <button className="btn pri" onClick={() => setEdit('new')}><Ic n="plus" />Nuova {label}</button>}
      </div>
      <div className="card" style={{ overflow: 'auto' }}>
        <table className="t">
          <thead><tr>
            <th style={{ width: 80 }}>{ams ? 'Ticket' : 'ID'}</th>{area === 'MC' && <th>Type</th>}<th>{ams ? 'Subject' : 'Description'}</th><th>Priorità</th>
            <th>{ams ? 'Opened' : 'Requested'}</th>{!ams && <th>GoLive</th>}<th>Owner</th>{!ams && <th>Stima</th>}{!ams && <th>Contract</th>}<th>Status</th><th style={{ width: 118 }} />
          </tr></thead>
          <tbody>
            {rows.map((i) => {
              const n = all.indexOf(i) + 1;
              return (
                <tr key={i.id} className="r" onClick={() => canEdit && setEdit(i)}>
                  <td><b>{ams ? i.code : `${prefix}-${String(n).padStart(2, '0')}`}</b></td>
                  {area === 'MC' && <td>{i.type}</td>}
                  <td style={{ minWidth: 240 }}>{i.description}</td><td>{i.priority}</td><td>{i.requested_date}</td>{!ams && <td>{i.golive_date}</td>}
                  <td>{i.owner}</td>{!ams && <td>{i.estimate}</td>}{!ams && <td>{i.contract}</td>}<td><StatusPill s={i.status} /></td>
                  <td onClick={(e) => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                    {canEdit && <>
                      <button className="ib" title="Su" disabled={n === 1} onClick={() => act(i.id, { move: 'up' })}><Ic n="up" /></button>{' '}
                      <button className="ib" title="Giù" disabled={n === all.length} onClick={() => act(i.id, { move: 'down' })}><Ic n="down" /></button>{' '}
                      <button className="ib" title="Segna Done e archivia" onClick={() => act(i.id, { status: 'completed' }, 'Archiviato')}><Ic n="ck" /></button>
                    </>}
                  </td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={11} className="muted" style={{ padding: 24, textAlign: 'center' }}>Nessuna voce.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="muted" style={{ marginTop: 12, fontSize: 13 }}>Max 12 righe per slide: oltre, la tabella continua automaticamente sulla pagina successiva. Gli ID si rinumerano da soli.</div>
      {edit && <ItemModal area={area} item={edit === 'new' ? undefined : edit} label={label} onClose={() => setEdit(null)} />}
    </>
  );
}
