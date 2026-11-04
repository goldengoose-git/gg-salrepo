'use client';
import { useState } from 'react';
import { useApp } from '@/components/AppShell';
import ExportModal from '@/components/ExportModal';
import Modal from '@/components/Modal';
import { Thumb } from '@/components/SlideView';
import { Ic } from '@/components/icons';
import { api } from '@/lib/client';
import { buildSlides } from '@/lib/slides';
import { addDays, isIso, parseSalLabel, weekLabel } from '@/lib/dates';

const DAYS = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const dayName = (iso: string) => (isIso(iso) ? DAYS[new Date(iso + 'T12:00:00Z').getUTCDay()] : '');

export default function Anteprima() {
  const { me, state, reload, toast } = useApp();
  const d = state!.deck;
  const salNow = d.sal_date || parseSalLabel(d.date_label) || '';
  const [f, setF] = useState({ client: d.client, subtitle: d.subtitle, sal_date: salNow });
  const [exp, setExp] = useState(false);
  const [dup, setDup] = useState<null | { sal_date: string }>(null);
  const slides = buildSlides(state!, true);
  const dirty = JSON.stringify(f) !== JSON.stringify({ client: d.client, subtitle: d.subtitle, sal_date: salNow });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function run(fn: () => Promise<any>, ok: string) { try { await fn(); await reload(); toast(ok); } catch (e: any) { toast(e.message); } }
  return (
    <>
      <div className="top"><h2>Anteprima ed export</h2><span className="sp" />
        <span className="muted">{d.status === 'published' ? `Pubblicata ${d.published_at?.slice(0, 10)}` : 'Bozza'}</span>
        {d.export_status === 'ok' && <span className="muted" title={d.export_at ?? ''}>· {d.export_url ? <a href={d.export_url} target="_blank" rel="noreferrer">PPTX su SharePoint ✓</a> : 'PPTX su SharePoint ✓'}</span>}
        {d.export_status === 'error' && <span style={{ color: '#c0392b', fontSize: 13 }} title={d.export_error ?? ''}>· Export SharePoint non riuscito</span>}
        {me.role === 'ADMIN' && d.export_status && <button className="btn" onClick={() => run(() => api('/api/deck/export', 'POST'), 'PPTX esportato su SharePoint')}>Riesporta</button>}
        <button className="btn" onClick={() => run(() => api('/api/deck/publish', 'POST'), 'Settimana pubblicata (copia salvata nello storico; PPTX su SharePoint se configurato)')}>Pubblica settimana</button>
        <button className="btn" onClick={() => setDup({ sal_date: salNow ? addDays(salNow, 7) : '' })}><Ic n="cp" />Nuova settimana</button>
        <a className="btn" href="/api/export/backup"><Ic n="dl" />Backup completo</a>
        <a className="btn" href="/presenta" title="Presentazione a schermo intero"><Ic n="pv" />Presenta</a>
        <button className="btn pri" onClick={() => setExp(true)}><Ic n="dl" />Esporta</button></div>
      <div className="body" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,300px)', gap: '18px 20px' }}>
          {slides.map((s, i) => <div key={i}><a href={`/presenta?s=${i + 1}`} title="Presenta da questa slide" style={{ display: 'block' }}><Thumb s={s} deck={d} no={i + 1} /></a><div className="muted" style={{ fontSize: 12, marginTop: 5 }}>{i + 1} · {s.kind === 'table' ? s.title + (s.part ? ` (${s.part})` : '') : s.kind}</div></div>)}
        </div>
        <div className="card" style={{ padding: 18 }}>
          <div className="lab">Dati cover</div>
          <div className="f" style={{ marginTop: 12 }}><label className="muted" style={{ fontSize: 12.5 }}>Data del SAL</label>
            <input type="date" value={f.sal_date} onChange={(e) => setF({ ...f, sal_date: e.target.value })} />
            <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>{isIso(f.sal_date) ? <>{dayName(f.sal_date)} · <b>{weekLabel(f.sal_date)}</b> (calcolata dalla data)</> : 'Scegli la data'}</div></div>
          {([['client', 'Cliente'], ['subtitle', 'Sottotitolo']] as const).map(([k, l]) => (
            <div key={k} className="f" style={{ marginTop: 12 }}><label className="muted" style={{ fontSize: 12.5 }}>{l}</label><input value={f[k]} onChange={set(k)} /></div>
          ))}
          <button className="btn pri" style={{ marginTop: 16, width: '100%', justifyContent: 'center' }} disabled={!dirty || !isIso(f.sal_date)} onClick={() => run(() => api('/api/deck', 'PATCH', f), 'Salvato')}>Salva</button>
          <div className="lab" style={{ marginTop: 24 }}>Storico settimane</div>
          {state!.snapshots.length ? state!.snapshots.map((s) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 13 }}>
              <span style={{ flex: 1 }}>{s.week_label} <span className="muted">· {s.created_at.slice(0, 10)}</span></span>
              <a className="ib" href={`/api/snapshots/${s.id}`} title="Scarica JSON"><Ic n="dl" /></a>
              <button className="ib" title="Elimina dallo storico" onClick={() => { if (confirm(`Eliminare "${s.week_label}" dallo storico? L'operazione non si può annullare.`)) run(() => api(`/api/snapshots/${s.id}`, 'DELETE'), 'Eliminata dallo storico'); }}><Ic n="tr" /></button>
            </div>
          )) : <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>Nessuna settimana pubblicata.</div>}
        </div>
      </div>
      {exp && <ExportModal onClose={() => setExp(false)} />}
      {dup && (
        <Modal title="Nuova settimana" onClose={() => setDup(null)} width={460}
          footer={<><span className="sp" /><button className="btn" onClick={() => setDup(null)}>Annulla</button>
            <button className="btn pri" disabled={!isIso(dup.sal_date)} onClick={() => run(async () => { await api('/api/deck/duplicate', 'POST', dup); setDup(null); }, 'Nuova settimana creata')}>Crea</button></>}>
          <p className="muted" style={{ marginTop: 0, fontSize: 13.5, lineHeight: 1.5 }}>Copia righe, timeline e grafica della settimana corrente. Le voci Completed/Done di questa settimana passano in Archivio nella nuova settimana.</p>
          <div className="f"><label className="lab">Data del SAL</label><input type="date" value={dup.sal_date} onChange={(e) => setDup({ sal_date: e.target.value })} autoFocus />
            <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>{isIso(dup.sal_date) ? <>{dayName(dup.sal_date)} · <b>{weekLabel(dup.sal_date)}</b>: Week e data in cover si calcolano da qui</> : 'Scegli la data'}</div></div>
        </Modal>
      )}
    </>
  );
}
