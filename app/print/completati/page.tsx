'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/client';

type R = { area: 'MC' | 'SC' | 'AMS'; code: string; type: string; description: string; owner: string; contract: string; closed: string; week_label: string };
const AREAS: { k: R['area']; l: string }[] = [{ k: 'MC', l: 'Marketing Cloud' }, { k: 'SC', l: 'CRM & Service Cloud' }, { k: 'AMS', l: 'Ticket AMS' }];
const d10 = (s: string) => { const [y, m, d] = s.slice(0, 10).split('-'); return `${d}/${m}/${y}`; };

function Inner() {
  const sp = useSearchParams();
  const [data, setData] = useState<{ days: number; rows: R[] } | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { api<{ days: number; rows: R[] }>(`/api/completed?days=${sp.get('days') ?? 14}`).then(setData).catch((e) => setErr(e.message)); }, [sp]);
  useEffect(() => {
    if (!data) return;
    document.title = `GG_SAL_Completati_${data.days}gg_${new Date().toISOString().slice(0, 10)}`;
    if (sp.get('auto') === '1') setTimeout(() => window.print(), 800);
  }, [data, sp]);
  if (err) return <div style={{ padding: 20 }}>{err}</div>;
  if (!data) return <div style={{ padding: 20 }}>Preparo l&apos;elenco…</div>;
  const today = new Date().toLocaleDateString('it-IT');
  return (
    <div style={{ background: '#fff', color: '#222', font: '12px Outfit, Montserrat, sans-serif', padding: 24 }}>
      <style>{`@media print{@page{size:A4 landscape;margin:12mm}html,body{background:#fff}.noprint{display:none!important}}
        .cmp table{width:100%;border-collapse:collapse;margin:6px 0 18px} .cmp th,.cmp td{border-bottom:1px solid #ddd;padding:5px 7px;text-align:left;vertical-align:top}
        .cmp th{background:#f0f0f0;font-weight:700} .cmp tr{break-inside:avoid} .cmp h2{margin:18px 0 0;font:800 15px Montserrat,sans-serif;border-left:6px solid #7135A8;padding-left:8px}`}</style>
      <div className="noprint" style={{ marginBottom: 14 }}><button className="btn pri" onClick={() => window.print()}>Stampa / Salva come PDF</button></div>
      <div className="cmp">
        <div style={{ font: '800 20px Montserrat, sans-serif' }}>Golden Goose · Completed ultimi {data.days} giorni (storico settimane)</div>
        <div style={{ color: '#666', marginTop: 4 }}>Generato il {today} · {data.rows.length} voci (MC {data.rows.filter((r) => r.area === 'MC').length} · SC {data.rows.filter((r) => r.area === 'SC').length} · AMS {data.rows.filter((r) => r.area === 'AMS').length})</div>
        {AREAS.map(({ k, l }) => {
          const rows = data.rows.filter((r) => r.area === k);
          return (
            <div key={k}>
              <h2>{l} ({rows.length})</h2>
              {rows.length ? (
                <table>
                  <thead><tr><th style={{ width: 80 }}>{k === 'AMS' ? 'Ticket' : 'Tipo'}</th><th>Descrizione</th><th style={{ width: 150 }}>Owner</th><th style={{ width: 110 }}>Contract</th><th style={{ width: 80 }}>Chiuso il</th><th style={{ width: 70 }}>Settimana</th></tr></thead>
                  <tbody>{rows.map((r, i) => <tr key={i}><td>{k === 'AMS' ? r.code : r.type}</td><td>{r.description}</td><td>{r.owner}</td><td>{r.contract}</td><td>{d10(r.closed)}</td><td>{r.week_label}</td></tr>)}</tbody>
                </table>
              ) : <div style={{ color: '#888', margin: '6px 0 18px' }}>Nessuna voce.</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
export default function Completati() { return <Suspense fallback={null}><Inner /></Suspense>; }
