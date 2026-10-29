'use client';
import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/components/AppShell';
import { Thumb } from '@/components/SlideView';
import { Ic } from '@/components/icons';
import { api, uploadImage } from '@/lib/client';

type K = 'logo_left_url' | 'logo_right_url' | 'bg_cover_url' | 'bg_divider_url' | 'bg_table_url';
const SLOTS: { k: K; t: string; h: string; logo?: boolean }[] = [
  { k: 'logo_left_url', t: 'Logo sinistra', h: 'PNG/SVG trasparente', logo: true },
  { k: 'logo_right_url', t: 'Logo destra', h: 'PNG/SVG trasparente', logo: true },
  { k: 'bg_cover_url', t: 'Sfondo cover', h: '1280×720 consigliato' },
  { k: 'bg_divider_url', t: 'Sfondo divider e chiusura', h: '1280×720 consigliato' },
  { k: 'bg_table_url', t: 'Sfondo tabelle (opzionale)', h: 'Chiaro, per non coprire il testo' },
];

function Slot({ k, t, h, logo }: (typeof SLOTS)[number]) {
  const { state, reload, toast } = useApp();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const url = state!.deck[k];
  async function up(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      await api('/api/deck', 'PATCH', { [k]: await uploadImage(file) }); await reload(); toast('Caricato');
    } catch (e: any) { toast(e.message); }
    setBusy(false);
  }
  return (
    <div>
      <div className="lab" style={{ marginBottom: 6 }}>{t}</div>
      <div className="drop" style={{ height: 116, background: url ? (logo ? '#fff' : '#000') : undefined, padding: 6 }}
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); up(e.dataTransfer.files[0]); }}>
        {url ? <img src={url} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: logo ? 'contain' : 'cover', width: logo ? undefined : '100%', height: logo ? undefined : '100%' }} />
          : <><Ic n="up" /><b style={{ color: 'var(--fg)' }}>{busy ? 'Carico…' : 'Trascina qui'}</b><span>{h}</span></>}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button className="btn" style={{ height: 30 }} onClick={() => ref.current?.click()} disabled={busy}>{url ? 'Sostituisci' : 'Scegli file'}</button>
        {url && <button className="btn danger" style={{ height: 30 }} onClick={async () => { await api('/api/deck', 'PATCH', { [k]: '' }); await reload(); }}>Rimuovi</button>}
        <input ref={ref} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden onChange={(e) => up(e.target.files?.[0])} />
      </div>
    </div>
  );
}

function LoginLogo() {
  const { toast } = useApp();
  const ref = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetch('/api/branding').then((r) => r.json()).then((j) => setUrl(j.login_logo_url)).catch(() => {}); }, []);
  async function save(u: string) { await api('/api/branding', 'PATCH', { login_logo_url: u }); setUrl(u || null); }
  async function up(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      await save(await uploadImage(file)); toast('Logo login aggiornato');
    } catch (e: any) { toast(e.message); }
    setBusy(false);
  }
  return (
    <div className="card" style={{ padding: 20, marginTop: 20 }}>
      <div className="lab" style={{ marginBottom: 10 }}>Logo pagina di login</div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <div className="drop" style={{ width: 220, height: 90, background: '#fff', padding: 8, flex: 'none' }}>
          {url ? <img src={url} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : <span style={{ color: '#777' }}>Nessun logo</span>}
        </div>
        <div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" disabled={busy} onClick={() => ref.current?.click()}>{busy ? 'Carico…' : url ? 'Sostituisci' : 'Carica logo'}</button>
            {url && <button className="btn danger" onClick={() => save('')}>Rimuovi</button>}
            <input ref={ref} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden onChange={(e) => up(e.target.files?.[0])} />
          </div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>Visibile a tutti nella schermata di accesso, valido per ogni settimana.</div>
        </div>
      </div>
    </div>
  );
}

export default function Impostazioni() {
  const { state, reload, toast } = useApp();
  const d = state!.deck;
  const [ov, setOv] = useState(d.overlay);
  return (
    <>
      <div className="top"><h2>Sfondi e loghi</h2></div>
      <div className="body" style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24, alignItems: 'start' }}>
        <div className="card" style={{ padding: 20 }}>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>{SLOTS.map((s) => <Slot key={s.k} {...s} />)}</div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 18, lineHeight: 1.5 }}>PNG, JPG, SVG o WEBP fino a 4 MB. I file sono salvati su Vercel Blob e usati in anteprima, PDF e PPTX.</div>
          <LoginLogo />
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div className="lab" style={{ marginBottom: 10 }}>Anteprima cover</div>
          <Thumb s={{ kind: 'cover' }} deck={{ ...d, overlay: ov }} w={318} />
          <div className="f" style={{ marginTop: 16 }}><label className="lab">Overlay scuro su cover e divider: {ov}%</label>
            <input type="range" min={0} max={90} value={ov} onChange={(e) => setOv(+e.target.value)} style={{ padding: 0 }} /></div>
          <button className="btn pri" style={{ marginTop: 14 }} disabled={ov === d.overlay} onClick={async () => { await api('/api/deck', 'PATCH', { overlay: ov }); await reload(); toast('Salvato'); }}>Salva overlay</button>
        </div>
      </div>
    </>
  );
}
