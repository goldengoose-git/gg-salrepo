'use client';
import { useState } from 'react';
import { PRIORITIES, STATUS, STATUS_KEYS, type Area, type Status } from '@/lib/constants';
import { api } from '@/lib/client';
import type { Item } from '@/lib/types';
import { useApp } from './AppShell';
import Modal from './Modal';
import { StatusPill } from './StatusPill';
import { Prio } from '@/lib/prio';

const EMPTY = { activity: '', code: '', type: '', description: '', priority: 'Medium', requested_date: '', golive_date: '', owner: '', estimate: '', contract: '', status: 'ontrack' as Status };

export default function ItemModal({ area, item, label, onClose }: { area: Area; item?: Item; label: string; onClose: () => void }) {
  const { reload, toast } = useApp();
  const [f, setF] = useState({ ...EMPTY, ...(item ? {
    activity: item.activity, code: item.code, type: item.type, description: item.description, priority: item.priority, requested_date: item.requested_date,
    golive_date: item.golive_date, owner: item.owner, estimate: item.estimate, contract: item.contract, status: item.status } : {}) });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<any>) => setF({ ...f, [k]: e.target.value });
  const ams = area === 'AMS';

  async function save() {
    if (!f.description.trim()) { setErr(ams ? 'Inserisci il subject' : 'Inserisci la descrizione'); return; }
    if (ams && !f.code.trim()) { setErr('Inserisci il codice ticket'); return; }
    setBusy(true); setErr('');
    try {
      if (item) await api(`/api/items/${item.id}`, 'PATCH', f);
      else await api('/api/items', 'POST', { area, ...f });
      await reload(); toast(f.status === 'completed' ? 'Salvato e archiviato' : 'Salvato'); onClose();
    } catch (e: any) { setErr(e.message); setBusy(false); }
  }
  async function del() {
    if (!item || !confirm('Eliminare definitivamente questa voce?')) return;
    setBusy(true);
    try { await api(`/api/items/${item.id}`, 'DELETE'); await reload(); onClose(); } catch (e: any) { setErr(e.message); setBusy(false); }
  }
  const L = (t: string, c: React.ReactNode, span = 1) => (
    <div className="f" style={{ gridColumn: `span ${span}` }}><label className="lab">{t}</label>{c}</div>
  );
  return (
    <Modal title={<>{item ? 'Modifica' : 'Nuova'} {label} {item && <span style={{ marginLeft: 8 }}><StatusPill s={item.status} /></span>}</>} onClose={onClose}
      footer={<>
        {item && <button className="btn danger" onClick={del} disabled={busy}>Elimina</button>}
        <span className="sp" />{err && <span className="err">{err}</span>}
        <button className="btn" onClick={onClose}>Annulla</button>
        <button className="btn pri" onClick={save} disabled={busy}>{busy ? 'Salvo…' : 'Salva'}</button>
      </>}>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        {ams && L('Codice ticket', <input value={f.code} onChange={set('code')} placeholder="AC-1234" />)}
        {!ams && area === 'MC' && L('Type', <input value={f.type} onChange={set('type')} placeholder="Journey, Email, Data…" />)}
        {L(ams ? 'Subject' : 'Description', <textarea value={f.description} onChange={set('description')} />, ams ? 2 : 3)}
        <div className="f" style={{ gridColumn: 'span 3' }}>
          <label className="lab">Priorità</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PRIORITIES.map((p) => (
              <button type="button" key={p} onClick={() => setF({ ...f, priority: f.priority === p ? '' : p })} className="chip"
                style={{ height: 32, padding: '0 12px', color: 'var(--fgb)', border: f.priority === p ? '2px solid var(--fgb)' : '1px solid var(--line2)', background: f.priority === p ? 'var(--line2)' : 'var(--hover)' }}>
                <Prio p={p} size={16} />
              </button>
            ))}
          </div>
        </div>
        {L('Owner', <input value={f.owner} onChange={set('owner')} />)}
        {L(ams ? 'Opened' : 'Requested date', <input value={f.requested_date} onChange={set('requested_date')} placeholder="gg/mm" />)}
        {!ams && L('GoLive date', <input value={f.golive_date} onChange={set('golive_date')} placeholder="gg/mm" />)}
        {!ams && L('Stima', <input value={f.estimate} onChange={set('estimate')} placeholder="5 gg" />)}
        {L('Contract type e status', <input value={f.contract} onChange={set('contract')} />, ams ? 2 : 2)}
        {L(ams ? 'Stato ticket in slide' : 'Activity status (testo in slide)', <input value={f.activity} onChange={set('activity')} placeholder={ams ? 'new, in progress, in attesa di feedback da GG…' : 'Ongoing, To Do, Done…'} />)}
        <div className="f" style={{ gridColumn: 'span 3' }}>
          <label className="lab">Activity status</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {STATUS_KEYS.map((s) => (
              <button type="button" key={s} onClick={() => setF({ ...f, status: s })} className="pill"
                style={{ background: STATUS[s].color, color: STATUS[s].text, border: f.status === s ? '2px solid var(--fgb)' : '2px solid transparent', opacity: f.status === s ? 1 : 0.55 }}>
                {STATUS[s].label}
              </button>
            ))}
          </div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>Con Completed la voce passa in Archivio (ripristinabile).</div>
        </div>
      </div>
    </Modal>
  );
}
