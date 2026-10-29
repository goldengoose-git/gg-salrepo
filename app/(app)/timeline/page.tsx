'use client';
import { useState } from 'react';
import { useApp } from '@/components/AppShell';
import Modal from '@/components/Modal';
import { Ic } from '@/components/icons';
import { BAR_STATUS, LANES, lanesFor, type BarStatus, type Lane } from '@/lib/constants';
import { api } from '@/lib/client';
import { packRows, todayPos } from '@/lib/slides';
import type { Bar } from '@/lib/types';

const MONTHS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const THIRDS = ['inizio', 'metà', 'fine'];
const enc = (m: number, t: number, end: boolean) => m + (t + (end ? 1 : 0)) / 3;
const decStart = (v: number) => { const i = Math.min(35, Math.max(0, Math.floor(v * 3 + 0.01))); return { m: Math.floor(i / 3), t: i % 3 }; };
const decEnd = (v: number) => { const i = Math.min(35, Math.max(0, Math.ceil(v * 3 - 0.01) - 1)); return { m: Math.floor(i / 3), t: i % 3 }; };

type Draft = { id?: string; lane: Lane; label: string; status: BarStatus; sm: number; st: number; em: number; et: number };

export default function Timeline() {
  const { me, state, reload, toast } = useApp();
  const [d, setD] = useState<Draft | null>(null);
  const [err, setErr] = useState('');
  const mine = lanesFor(me.role);
  const bars = state!.bars;

  const open = (b?: Bar) => {
    if (b) { const s = decStart(b.start_m), e = decEnd(b.end_m); setD({ id: b.id, lane: b.lane, label: b.label, status: b.status, sm: s.m, st: s.t, em: e.m, et: e.t }); }
    else setD({ lane: mine[0], label: '', status: 'wip', sm: new Date().getMonth(), st: 0, em: Math.min(11, new Date().getMonth() + 2), et: 2 });
    setErr('');
  };
  async function save() {
    if (!d) return;
    if (!d.label.trim()) { setErr('Inserisci il titolo'); return; }
    const body = { lane: d.lane, label: d.label, status: d.status, start_m: enc(d.sm, d.st, false), end_m: enc(d.em, d.et, true) };
    if (body.end_m <= body.start_m) { setErr('La fine deve essere dopo l\'inizio'); return; }
    try { d.id ? await api(`/api/bars/${d.id}`, 'PATCH', body) : await api('/api/bars', 'POST', body); await reload(); toast('Salvato'); setD(null); }
    catch (e: any) { setErr(e.message); }
  }
  async function del() {
    if (!d?.id || !confirm('Eliminare questa attività?')) return;
    try { await api(`/api/bars/${d.id}`, 'DELETE'); await reload(); setD(null); } catch (e: any) { setErr(e.message); }
  }
  const T = todayPos();
  const set = (k: keyof Draft) => (e: React.ChangeEvent<any>) => setD({ ...d!, [k]: ['sm', 'st', 'em', 'et'].includes(k) ? +e.target.value : e.target.value });

  return (
    <>
      <div className="top"><h2>Timeline progetti {state!.deck.year}</h2><span className="sp" />
        <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#B6B9C2', alignItems: 'center' }}>
          {(Object.keys(BAR_STATUS) as BarStatus[]).map((k) => <span key={k}><i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: BAR_STATUS[k].color, marginRight: 6 }} />{BAR_STATUS[k].label}</span>)}
        </div>
        <button className="btn pri" onClick={() => open()}><Ic n="plus" />Nuova attività</button></div>
      <div className="body">
        <div className="card tl">
          <div className="tl-head"><div style={{ flex: 'none', width: 96 }} />{MONTHS.map((m) => <div key={m}>{m}</div>)}</div>
          {LANES.map((lane) => {
            const bs = bars.filter((b) => b.lane === lane);
            const packed = packRows(bs);
            const rows = Math.max(1, ...bs.map((b) => (packed.get(b) ?? 0) + 1));
            const editable = mine.includes(lane);
            return (
              <div className="tl-lane" key={lane}>
                <b>{lane}{!editable && <div className="muted" style={{ fontSize: 10, fontWeight: 400 }}>sola lettura</div>}</b>
                <div className="tl-grid" style={{ height: rows * 34 + 14 }}>
                  {bs.map((b) => (
                    <button key={b.id} className="tl-bar" disabled={!editable} onClick={() => open(b)} title={b.label}
                      style={{ left: `${(b.start_m / 12) * 100}%`, width: `${((b.end_m - b.start_m) / 12) * 100}%`, top: 8 + (packed.get(b) ?? 0) * 34, background: BAR_STATUS[b.status].color, color: BAR_STATUS[b.status].text, cursor: editable ? 'pointer' : 'default' }}>
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          <div className="tl-today" style={{ left: `calc(96px + (100% - 96px) * ${T / 12})` }} />
        </div>
        <div className="muted" style={{ marginTop: 12, fontSize: 13 }}>Clic su una barra per modificarla. MC gestisce SFMC e CROSS, SC gestisce SFSC. La riga rossa è oggi.</div>
      </div>
      {d && (
        <Modal title={d.id ? 'Modifica attività' : 'Nuova attività'} onClose={() => setD(null)} width={520}
          footer={<>{d.id && <button className="btn danger" onClick={del}>Elimina</button>}<span className="sp" />{err && <span className="err">{err}</span>}
            <button className="btn" onClick={() => setD(null)}>Annulla</button><button className="btn pri" onClick={save}>Salva</button></>}>
          <div className="grid">
            <div className="f"><label className="lab">Titolo</label><input value={d.label} onChange={set('label')} autoFocus /></div>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="f"><label className="lab">Lane</label><select value={d.lane} onChange={set('lane')}>{mine.map((l) => <option key={l}>{l}</option>)}</select></div>
              <div className="f"><label className="lab">Stato</label><select value={d.status} onChange={set('status')}>{(Object.keys(BAR_STATUS) as BarStatus[]).map((k) => <option key={k} value={k}>{BAR_STATUS[k].label}</option>)}</select></div>
            </div>
            <div className="f"><label className="lab">Inizio</label><div style={{ display: 'flex', gap: 8 }}>
              <select value={d.sm} onChange={set('sm')}>{MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}</select>
              <select value={d.st} onChange={set('st')}>{THIRDS.map((t, i) => <option key={t} value={i}>{t}</option>)}</select></div></div>
            <div className="f"><label className="lab">Fine</label><div style={{ display: 'flex', gap: 8 }}>
              <select value={d.em} onChange={set('em')}>{MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}</select>
              <select value={d.et} onChange={set('et')}>{THIRDS.map((t, i) => <option key={t} value={i}>{t}</option>)}</select></div></div>
          </div>
        </Modal>
      )}
    </>
  );
}
