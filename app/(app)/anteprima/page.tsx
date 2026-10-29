'use client';
import { useState } from 'react';
import { useApp } from '@/components/AppShell';
import ExportModal from '@/components/ExportModal';
import Modal from '@/components/Modal';
import { Thumb } from '@/components/SlideView';
import { Ic } from '@/components/icons';
import { api } from '@/lib/client';
import { buildSlides } from '@/lib/slides';

export default function Anteprima() {
  const { state, reload, toast } = useApp();
  const d = state!.deck;
  const [f, setF] = useState({ week_label: d.week_label, client: d.client, subtitle: d.subtitle, date_label: d.date_label });
  const [exp, setExp] = useState(false);
  const [dup, setDup] = useState<null | { week_label: string; date_label: string }>(null);
  const slides = buildSlides(state!, true);
  const dirty = JSON.stringify(f) !== JSON.stringify({ week_label: d.week_label, client: d.client, subtitle: d.subtitle, date_label: d.date_label });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function run(fn: () => Promise<any>, ok: string) { try { await fn(); await reload(); toast(ok); } catch (e: any) { toast(e.message); } }
  return (
    <>
      <div className="top"><h2>Anteprima ed export</h2><span className="sp" />
        <span className="muted">{d.status === 'published' ? `Pubblicata ${d.published_at?.slice(0, 10)}` : 'Bozza'}</span>
        <button className="btn" onClick={() => run(() => api('/api/deck/publish', 'POST'), 'Settimana pubblicata (copia salvata nello storico)')}>Pubblica settimana</button>
        <button className="btn" onClick={() => setDup({ week_label: '', date_label: '' })}><Ic n="cp" />Nuova settimana</button>
        <button className="btn pri" onClick={() => setExp(true)}><Ic n="dl" />Esporta</button></div>
      <div className="body" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,300px)', gap: '18px 20px' }}>
          {slides.map((s, i) => <div key={i}><Thumb s={s} deck={d} no={i + 1} /><div className="muted" style={{ fontSize: 12, marginTop: 5 }}>{i + 1} · {s.kind === 'table' ? s.title + (s.part ? ` (${s.part})` : '') : s.kind}</div></div>)}
        </div>
        <div className="card" style={{ padding: 18 }}>
          <div className="lab">Dati cover</div>
          {([['week_label', 'Settimana'], ['client', 'Cliente'], ['subtitle', 'Sottotitolo'], ['date_label', 'Data']] as const).map(([k, l]) => (
            <div key={k} className="f" style={{ marginTop: 12 }}><label className="muted" style={{ fontSize: 12.5 }}>{l}</label><input value={f[k]} onChange={set(k)} /></div>
          ))}
          <button className="btn pri" style={{ marginTop: 16, width: '100%', justifyContent: 'center' }} disabled={!dirty} onClick={() => run(() => api('/api/deck', 'PATCH', f), 'Salvato')}>Salva</button>
          <div className="lab" style={{ marginTop: 24 }}>Storico settimane</div>
          {state!.snapshots.length ? state!.snapshots.map((s) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 13 }}>
              <span style={{ flex: 1 }}>{s.week_label} <span className="muted">· {s.created_at.slice(0, 10)}</span></span>
              <a className="ib" href={`/api/snapshots/${s.id}`} title="Scarica JSON"><Ic n="dl" /></a>
            </div>
          )) : <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>Nessuna settimana pubblicata.</div>}
        </div>
      </div>
      {exp && <ExportModal onClose={() => setExp(false)} />}
      {dup && (
        <Modal title="Nuova settimana" onClose={() => setDup(null)} width={460}
          footer={<><span className="sp" /><button className="btn" onClick={() => setDup(null)}>Annulla</button>
            <button className="btn pri" disabled={!dup.week_label.trim()} onClick={() => run(async () => { await api('/api/deck/duplicate', 'POST', dup); setDup(null); }, 'Nuova settimana creata')}>Crea</button></>}>
          <p className="muted" style={{ marginTop: 0, fontSize: 13.5, lineHeight: 1.5 }}>Copia righe attive, timeline e grafica della settimana corrente. Le voci archiviate restano nella settimana precedente.</p>
          <div className="f"><label className="lab">Nome</label><input value={dup.week_label} onChange={(e) => setDup({ ...dup, week_label: e.target.value })} placeholder="Week 45" autoFocus /></div>
          <div className="f" style={{ marginTop: 12 }}><label className="lab">Data cover</label><input value={dup.date_label} onChange={(e) => setDup({ ...dup, date_label: e.target.value })} placeholder="5 novembre 2026" /></div>
        </Modal>
      )}
    </>
  );
}
