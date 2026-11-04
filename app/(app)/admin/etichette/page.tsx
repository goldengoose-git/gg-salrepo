'use client';
import { useMemo, useState } from 'react';
import { useApp } from '@/components/AppShell';
import LookupBox from '@/components/LookupBox';
import { AMS_KEYS, AMS_STATUS, BAR_STATUS, STATUS, STATUS_KEYS, type BarStatus } from '@/lib/constants';
import { api } from '@/lib/client';
import { KINDS } from '@/lib/lookups';
import type { ColorPair, UiColors } from '@/lib/types';
import { CONTRACT_DEFAULT, CONTRACT_KEYS, contrast, uiAms, uiBar, uiContract, uiStatus } from '@/lib/ui-colors';

type Row = { group: 'status' | 'ams' | 'bar' | 'contract'; key: string; label: string; def: ColorPair; cur: ColorPair };

export default function AdminEtichette() {
  const { state, reload, toast } = useApp();
  const saved = state!.uiColors;
  const [draft, setDraft] = useState<UiColors>(saved);
  const [busy, setBusy] = useState(false);
  const rows: Row[] = useMemo(() => [
    ...STATUS_KEYS.map((k) => ({ group: 'status' as const, key: k, label: STATUS[k].label, def: { color: STATUS[k].color, text: STATUS[k].text }, cur: uiStatus(draft, k) })),
    ...AMS_KEYS.map((k) => ({ group: 'ams' as const, key: k, label: AMS_STATUS[k].label, def: { color: AMS_STATUS[k].color, text: AMS_STATUS[k].text }, cur: uiAms(draft, k) })),
    ...(Object.keys(BAR_STATUS) as BarStatus[]).map((k) => ({ group: 'bar' as const, key: k, label: BAR_STATUS[k].label, def: { color: BAR_STATUS[k].color, text: BAR_STATUS[k].text }, cur: uiBar(draft, k) })),
    ...CONTRACT_KEYS.map((k) => ({ group: 'contract' as const, key: k, label: k, def: CONTRACT_DEFAULT[k], cur: uiContract(draft, k) })),
  ], [draft]);
  const GROUPS = { status: 'Activity status · MC e SC', ams: 'Ticket AMS · stati Jira', bar: 'Timeline · barre', contract: 'Contract · OPEX / CAPEX' } as const;

  function set(r: Row, patch: Partial<ColorPair>) {
    const next: any = { ...draft, [r.group]: { ...(draft as any)[r.group] } };
    next[r.group][r.key] = { ...r.cur, ...patch };
    setDraft(next);
  }
  function reset(r: Row) {
    const next: any = { ...draft, [r.group]: { ...(draft as any)[r.group] } };
    delete next[r.group][r.key];
    setDraft(next);
  }
  async function save(colors: UiColors) {
    setBusy(true);
    try { await api('/api/admin/colors', 'PUT', { colors }); await reload(); toast('Colori salvati (solo interfaccia interna)'); } catch (e: any) { toast(e.message); }
    setBusy(false);
  }
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  return (
    <>
      <div className="top"><h2>Colori ed Elenchi</h2><span className="muted">Solo Admin All</span></div>
      <div className="body" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div className="lab">Colori label</div><span className="sp" />
            <button className="btn" disabled={busy} onClick={() => { if (confirm('Ripristinare tutti i colori predefiniti?')) { setDraft({}); save({}); } }}>Ripristina predefiniti</button>
            <button className="btn pri" disabled={busy || !dirty} onClick={() => save(draft)}>Salva colori</button>
          </div>
          <div className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>Valgono solo per l&apos;interfaccia interna (tabelle, modali, timeline, etichette OPEX/CAPEX). Slide, anteprima, PDF e PPTX mantengono i colori originali.</div>
          {(['status', 'ams', 'bar', 'contract'] as const).map((g) => (
            <div key={g} style={{ marginBottom: 14 }}>
              <div className="lab" style={{ margin: '8px 0 6px' }}>{GROUPS[g]}</div>
              {rows.filter((r) => r.group === g).map((r) => {
                const ratio = contrast(r.cur.color, r.cur.text);
                const changed = r.cur.color.toUpperCase() !== r.def.color.toUpperCase() || r.cur.text.toUpperCase() !== r.def.text.toUpperCase();
                return (
                  <div key={r.group + r.key} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 1fr 70px', gap: 10, alignItems: 'center', padding: '6px 0', borderTop: '1px solid var(--line4)' }}>
                    <span className="pill" style={{ background: r.cur.color, color: r.cur.text, textAlign: 'center' }}>{r.label}</span>
                    <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5 }}><input type="color" aria-label={`Sfondo ${r.label}`} value={r.cur.color} onChange={(e) => set(r, { color: e.target.value.toUpperCase() })} style={{ width: 34, height: 28, padding: 0 }} />Sfondo</label>
                    <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5 }}><input type="color" aria-label={`Testo ${r.label}`} value={r.cur.text} onChange={(e) => set(r, { text: e.target.value.toUpperCase() })} style={{ width: 34, height: 28, padding: 0 }} />Testo</label>
                    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                      {changed && <button className="btn" style={{ height: 24, padding: '0 8px', fontSize: 12 }} onClick={() => reset(r)}>↺</button>}
                      {ratio < 4.5 && <span style={{ fontSize: 11, color: '#E9A800' }} title="Contrasto testo/sfondo sotto 4.5:1">{ratio.toFixed(1)}:1 ⚠</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="muted" style={{ fontSize: 13 }}>Come Admin All modifichi tutti gli elenchi, anche i Type dell&apos;altro team. Rinomina e unione si applicano a <b>tutte le settimane</b>.</div>
          {KINDS.map((k) => <LookupBox key={k.kind} {...k} allWeeks />)}
        </div>
      </div>
    </>
  );
}
