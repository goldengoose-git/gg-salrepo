'use client';
import { useEffect, useState } from 'react';
import { useApp } from '@/components/AppShell';
import { api } from '@/lib/client';
import type { Change, DateField, Rule } from '@/lib/normalize';

type Preview = { week: string; analyzed: number; total: number; changes: Change[] };
type Last = { id: string; at: string; by: string; n: number; undone: boolean } | null;
const FIELD_LABEL: Record<DateField, string> = { requested_date: 'Requested / Opened', golive_date: 'GoLive', release_date: 'Release' };

export default function AdminNormalizza() {
  const { state, reload, toast } = useApp();
  const [months, setMonths] = useState(true);
  const [prefixes, setPrefixes] = useState(true);
  const [rules, setRules] = useState<Rule[]>([]);
  const [fields, setFields] = useState<DateField[]>(['requested_date', 'golive_date', 'release_date']);
  const [prev, setPrev] = useState<Preview | null>(null);
  const [last, setLast] = useState<Last>(null);
  const [busy, setBusy] = useState(false);
  const body = { months, prefixes, rules: rules.filter((r) => r.from.trim()), fields };

  async function loadLast() { try { setLast((await api<{ last: Last }>('/api/admin/normalize')).last); } catch {} }
  async function analyze() {
    setBusy(true);
    try { setPrev(await api<Preview>('/api/admin/normalize', 'POST', { ...body, dryRun: true })); } catch (e: any) { toast(e.message); }
    setBusy(false);
  }
  useEffect(() => { loadLast(); }, []);
  useEffect(() => { const t = setTimeout(analyze, 300); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [months, prefixes, JSON.stringify(rules), fields.join()]);

  async function apply() {
    if (!prev?.total || !confirm(`Applicare ${prev.total} modifiche alla settimana corrente (${prev.week})?`)) return;
    setBusy(true);
    try { const r = await api<{ applied: number }>('/api/admin/normalize', 'POST', body); await reload(); await loadLast(); toast(`${r.applied} valori normalizzati`); await analyze(); } catch (e: any) { toast(e.message); }
    setBusy(false);
  }
  async function undo() {
    if (!confirm('Annullare l\'ultima normalizzazione? Vengono ripristinati solo i valori non modificati nel frattempo.')) return;
    setBusy(true);
    try { const r = await api<{ restored: number }>('/api/admin/normalize', 'DELETE'); await reload(); await loadLast(); toast(`${r.restored} valori ripristinati`); await analyze(); } catch (e: any) { toast(e.message); }
    setBusy(false);
  }
  const toggle = (f: DateField) => setFields((x) => (x.includes(f) ? x.filter((y) => y !== f) : [...x, f]));
  return (
    <>
      <div className="top"><h2>Normalizza date</h2><span className="muted">Solo settimana corrente ({state!.deck.week_label}) · Solo Admin All</span></div>
      <div className="body" style={{ display: 'grid', gridTemplateColumns: '360px minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>
        <div className="card" style={{ padding: 20, display: 'grid', gap: 16 }}>
          <div>
            <div className="lab" style={{ marginBottom: 8 }}>Regole automatiche</div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}><input type="checkbox" checked={months} onChange={(e) => setMonths(e.target.checked)} />Mesi a 3 lettere (Sept → Sep, June → Jun…)</label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={prefixes} onChange={(e) => setPrefixes(e.target.checked)} />Beginning/Begin → Beg, Middle → Mid</label>
          </div>
          <div>
            <div className="lab" style={{ marginBottom: 8 }}>Sostituzioni personalizzate</div>
            {rules.map((r, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 18px 1fr 28px', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                <input aria-label="Cerca" value={r.from} placeholder="Cerca" onChange={(e) => setRules(rules.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)))} />
                <span className="muted">→</span>
                <input aria-label="Sostituisci con" value={r.to} placeholder="Sostituisci con" onChange={(e) => setRules(rules.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)))} />
                <button className="ib" aria-label="Rimuovi regola" onClick={() => setRules(rules.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            <button className="btn" onClick={() => setRules([...rules, { from: '', to: '' }])}>+ Aggiungi regola</button>
          </div>
          <div>
            <div className="lab" style={{ marginBottom: 8 }}>Campi</div>
            {(Object.keys(FIELD_LABEL) as DateField[]).map((f) => (
              <label key={f} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}><input type="checkbox" checked={fields.includes(f)} onChange={() => toggle(f)} />{FIELD_LABEL[f]}</label>
            ))}
          </div>
          <div className="muted" style={{ fontSize: 12.5 }}>Prima di applicare scarica un backup da «Backup e ripristino». Ogni applicazione è nell&apos;audit log e si può annullare.</div>
        </div>
        <div className="card" style={{ overflow: 'auto' }}>
          <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div className="lab">Anteprima modifiche</div><span className="sp" />
            <span style={{ fontSize: 13.5 }}>{prev ? <><b>{prev.total}</b> valori da modificare su <b>{prev.analyzed}</b> voci analizzate</> : 'Analisi…'}</span>
            <button className="btn" disabled={busy || !last || last.undone} onClick={undo} title={last ? `Ultima: ${last.n} valori, ${new Date(last.at).toLocaleString('it-IT')} (${last.by})` : ''}>Annulla ultima normalizzazione</button>
            <button className="btn pri" disabled={busy || !prev?.total} onClick={apply}>Applica a {prev?.total ?? 0} valori</button>
          </div>
          <table className="t">
            <thead><tr><th>Ticket / ID</th><th>Area</th><th>Campo</th><th>Prima</th><th>Dopo</th></tr></thead>
            <tbody>
              {prev?.changes.map((c, i) => (
                <tr key={c.id + c.field + i}>
                  <td><b>{c.code || '—'}</b></td><td>{c.area}</td><td>{FIELD_LABEL[c.field]}</td>
                  <td><span style={{ background: 'rgba(224,48,30,.18)', padding: '2px 8px', borderRadius: 6, textDecoration: 'line-through' }}>{c.before}</span></td>
                  <td><span style={{ background: 'rgba(52,168,83,.2)', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>{c.after}</span></td>
                </tr>
              ))}
              {prev && !prev.total && <tr><td colSpan={5} className="muted" style={{ padding: 24, textAlign: 'center' }}>Nessun valore da normalizzare.</td></tr>}
            </tbody>
          </table>
          {prev && prev.total > prev.changes.length && <div className="muted" style={{ padding: 12, fontSize: 12.5 }}>Mostrate le prime {prev.changes.length} modifiche su {prev.total}.</div>}
        </div>
      </div>
    </>
  );
}
