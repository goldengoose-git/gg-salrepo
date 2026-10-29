'use client';
import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/components/AppShell';
import Modal from '@/components/Modal';
import { Ic } from '@/components/icons';
import { BAR_STATUS, LANES, lanesFor, type BarStatus, type Lane } from '@/lib/constants';
import { api } from '@/lib/client';
import { layoutBars, todayPos } from '@/lib/slides';
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
  const [compact, setCompact] = useState(true);
  const gridRef = useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = useState(900);
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const observer = new ResizeObserver(([entry]) => setGridWidth(entry.contentRect.width));
    observer.observe(grid);
    return () => observer.disconnect();
  }, []);
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
        <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--fg2)', alignItems: 'center' }}>
          {(Object.keys(BAR_STATUS) as BarStatus[]).map((k) => <span key={k}><i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: BAR_STATUS[k].color, marginRight: 6 }} />{BAR_STATUS[k].label}</span>)}
        </div>
        <button className="btn" onClick={() => setCompact((v) => !v)} aria-pressed={compact}>{compact ? "Vista ampia" : "Vista compatta"}</button>
        <button className="btn pri" onClick={() => open()}><Ic n="plus" />Nuova attività</button></div>
      <div className="body">
        <div className="card tl">
          <div className="tl-head" style={{ borderBottom: 0 }}><div style={{ flex: 'none', width: 96 }} />{[1, 2, 3, 4].map((q) => <div key={q} style={{ flex: 3, borderLeft: '1px solid var(--line2)', color: 'var(--fg)', fontWeight: 800 }}>Q{q}</div>)}</div>
          <div className="tl-head"><div style={{ flex: 'none', width: 96 }} />{MONTHS.map((m, i) => <div key={m} style={{ borderLeft: i % 3 === 0 ? '1px solid var(--line2)' : undefined }}>{m}</div>)}</div>
          {LANES.map((lane) => {
            const byKey = bars.filter((b) => b.lane === lane);
            const editable = mine.includes(lane);
            const PITCH = compact ? 24 : 32;
            // Layout rows by the actual rendered width, not an assumed 1000px.
            // Labels stay in their bars with ellipsis and a full-text tooltip.
            const L = layoutBars(byKey.map((b) => ({ label: b.label, status: b.status, start_m: b.start_m, end_m: b.end_m, row: b.row })));
            const positioned = byKey.map((b, k) => {
              const left = Math.max(0, Math.min(100, b.start_m / 12 * 100));
              const right = Math.max(left, Math.min(100, b.end_m / 12 * 100));
              return { b, left, width: right - left, row: L.bars[k].row };
            });
            const rows = L.rows;
            return (
              <div className="tl-lane" key={lane} style={{ background: lane === 'CROSS' ? 'var(--rowh)' : undefined }}>
                <b>{lane}{!editable && <div className="muted" style={{ fontSize: 10, fontWeight: 400 }}>sola lettura</div>}</b>
                <div className="tl-grid" ref={lane === LANES[0] ? gridRef : undefined} style={{ height: rows * PITCH + 10, backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,.035) 50%, transparent 50%)', backgroundSize: `${100 / 6}% 100%` }}>
                  {[3, 6, 9].map((m) => <div key={m} style={{ position: 'absolute', left: `${(m / 12) * 100}%`, top: 0, bottom: 0, width: 1, background: 'var(--line2)' }} />)}
                  {positioned.map(({ b, left, width, row }) => (
                    <button key={b.id} className="tl-bar" disabled={!editable} onClick={() => open(b)} title={b.label}
                      style={{ left: `${left}%`, width: `${width}%`, top: 5 + row * PITCH, height: compact ? 20 : 26,
                        fontSize: compact ? 10.5 : 12, padding: compact ? '0 5px' : '0 9px',
                        background: BAR_STATUS[b.status].color, color: BAR_STATUS[b.status].text,
                        cursor: editable ? 'pointer' : 'default' }}>
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          <div className="tl-today" style={{ left: `calc(96px + (100% - 96px) * ${T / 12})` }} />
        </div>
        <div className="muted" style={{ marginTop: 12, fontSize: 13 }}>Clic su una barra per modificarla. MC gestisce SFMC e CROSS, SC gestisce SFSC. La riga rossa è oggi. Passa il mouse sulle barre per leggere il titolo completo.</div>
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
