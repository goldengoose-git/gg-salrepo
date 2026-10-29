'use client';
import { useState } from 'react';
import { download } from '@/lib/client';
import { useApp } from './AppShell';
import Modal from './Modal';
import { Ic } from './icons';

export default function ExportModal({ onClose }: { onClose: () => void }) {
  const { state, toast } = useApp();
  const [arch, setArch] = useState(false);
  const [busy, setBusy] = useState('');
  const n = state!.items;
  async function dl(kind: 'pptx' | 'xlsx') {
    setBusy(kind);
    try { await download(kind === 'pptx' ? `/api/export/pptx?archive=${arch ? 1 : 0}` : '/api/export/xlsx', `SAL.${kind}`); }
    catch (e: any) { toast(e.message); }
    setBusy('');
  }
  return (
    <Modal title={`Esporta Weekly SAL · ${state!.deck.week_label}`} onClose={onClose} width={820}>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div style={{ border: '2px solid #E0301E', borderRadius: 12, padding: 18, background: '#2a2020' }}>
          <b className="m" style={{ fontSize: 17 }}>PDF</b>
          <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.5 }}>16:9, una slide per pagina. Si apre la pagina di stampa: scegli &quot;Salva come PDF&quot;.</p>
          <a className="btn pri" style={{ width: '100%', justifyContent: 'center', height: 44 }} target="_blank" rel="noreferrer" href={`/print?auto=1&archive=${arch ? 1 : 0}`}><Ic n="dl" />Genera PDF</a>
        </div>
        <div style={{ border: '1px solid #3a3e49', borderRadius: 12, padding: 18 }}>
          <b className="m" style={{ fontSize: 17 }}>PPTX</b>
          <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.5 }}>Tabelle native PowerPoint modificabili, con sfondi e loghi caricati.</p>
          <button className="btn" style={{ width: '100%', justifyContent: 'center', height: 44 }} disabled={!!busy} onClick={() => dl('pptx')}><Ic n="dl" />{busy === 'pptx' ? 'Genero…' : 'Genera PPTX'}</button>
        </div>
        <div style={{ gridColumn: '1/3', border: '1px solid #333743', borderRadius: 10, padding: '12px 16px', display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={arch} onChange={(e) => setArch(e.target.checked)} />Includi pagine Completed Activities (archivio)</label>
          <span className="sp" />
          <span className="muted">MC {n.filter((i) => i.area === 'MC' && !i.archived_at).length} · SC {n.filter((i) => i.area === 'SC' && !i.archived_at).length} · AMS {n.filter((i) => i.area === 'AMS' && !i.archived_at).length}</span>
          <button className="btn" disabled={!!busy} onClick={() => dl('xlsx')}><Ic n="dl" />{busy === 'xlsx' ? '…' : 'XLSX archivio e ticket'}</button>
        </div>
      </div>
    </Modal>
  );
}
