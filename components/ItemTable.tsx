'use client';
import { useRef, useState } from 'react';
import { areasFor, type Area } from '@/lib/constants';
import { api } from '@/lib/client';
import type { Item } from '@/lib/types';
import { useApp } from './AppShell';
import { Ic } from './icons';
import ItemModal from './ItemModal';
import { StatusPill } from './StatusPill';
import { Prio } from '@/lib/prio';
import { fmtEstimate, parseContract } from '@/lib/lookups';

export function ContractPill({ v }: { v: string }) {
  const c = parseContract(v);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {c.type && <span className={'pill cx-' + c.type.toLowerCase()}>{c.type}</span>}
      {c.label && <span>{c.label}</span>}
    </span>
  );
}

export default function ItemTable({ area, prefix, label }: { area: Area; prefix: string; label: string }) {
  const { me, state, reload, toast } = useApp();
  const [edit, setEdit] = useState<Item | 'new' | null>(null);
  const [q, setQ] = useState('');
  const [fs, setFs] = useState('');
  const canEdit = areasFor(me.role).includes(area);
  const all = state!.items.filter((i) => i.area === area && !i.archived_at).sort((a, b) => a.position - b.position);
  const rows = all.filter((i) => (!fs || i.status === fs) && (!q || JSON.stringify(Object.values(i)).toLowerCase().includes(q.toLowerCase())));
  const ams = area === 'AMS';
  const showType = area !== 'AMS';
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<{ id: string; after: boolean } | null>(null);
  const canDrag = canEdit && !q && !fs;
  const grip = useRef(false); // il trascinamento parte solo dalla maniglia

  async function drop() {
    if (!drag || !over || drag === over.id) { setDrag(null); setOver(null); return; }
    const ids = all.map((i) => i.id).filter((x) => x !== drag);
    const at = ids.indexOf(over.id) + (over.after ? 1 : 0);
    ids.splice(at, 0, drag);
    setDrag(null); setOver(null);
    try { await api('/api/items/reorder', 'POST', { area, ids }); await reload(); } catch (e: any) { toast(e.message); }
  }

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
            {canDrag && <th style={{ width: 28, padding: 0 }} />}<th style={{ width: 80 }}>{ams ? 'Ticket' : 'ID'}</th>{showType && <th>Type</th>}<th>{ams ? 'Subject' : 'Description'}</th><th>Priorità</th>
            <th>{ams ? 'Opened' : 'Requested'}</th>{!ams && <th>GoLive</th>}<th>Owner</th>{!ams && <th>Stima</th>}{!ams && <th>Contract</th>}<th>Status</th><th style={{ width: 118 }} />
          </tr></thead>
          <tbody>
            {rows.map((i) => {
              const n = all.indexOf(i) + 1;
              return (
                <tr key={i.id} className={'r' + (drag === i.id ? ' dragging' : '') + (over?.id === i.id && drag !== i.id ? (over.after ? ' drop-after' : ' drop-before') : '')}
                  draggable={canDrag}
                  onDragStart={(e) => { if (!grip.current) { e.preventDefault(); return; } e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', i.id); setDrag(i.id); }}
                  onDragOver={(e) => { if (!drag) return; e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); setOver({ id: i.id, after: e.clientY > r.top + r.height / 2 }); }}
                  onDrop={(e) => { e.preventDefault(); grip.current = false; drop(); }}
                  onDragEnd={() => { grip.current = false; setDrag(null); setOver(null); }}
                  onClick={() => canEdit && setEdit(i)}>
                  {canDrag && <td className="grip" title="Trascina per riordinare" onClick={(e) => e.stopPropagation()}
                    onMouseDown={() => { grip.current = true; }} onMouseUp={() => { grip.current = false; }}>⋮⋮</td>}
                  <td><b>{ams ? i.code : `${prefix}-${String(n).padStart(2, '0')}`}</b></td>
                  {showType && <td>{i.type}</td>}
                  <td style={{ minWidth: 240 }}>{i.description}</td><td><Prio p={i.priority} size={15} /></td><td>{i.requested_date}</td>{!ams && <td>{i.golive_date}</td>}
                  <td>{i.owner}</td>{!ams && <td style={{ whiteSpace: 'nowrap' }}>{fmtEstimate(i.estimate)}</td>}{!ams && <td><ContractPill v={i.contract} /></td>}<td><StatusPill s={i.status} />{ams && i.activity && <div className="muted" style={{ fontSize: 11.5, marginTop: 3 }}>{i.activity}</div>}</td>
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
            {!rows.length && <tr><td colSpan={13} className="muted" style={{ padding: 24, textAlign: 'center' }}>Nessuna voce.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="muted" style={{ marginTop: 12, fontSize: 13 }}>Max 12 righe per slide: oltre, la tabella continua automaticamente sulla pagina successiva. Gli ID si rinumerano da soli. Trascina le righe dalla maniglia ⋮⋮ (con ricerca o filtro attivi il riordino è disattivato) oppure usa le frecce.</div>
      {edit && <ItemModal area={area} item={edit === 'new' ? undefined : edit} label={label} onClose={() => setEdit(null)} />}
    </>
  );
}
