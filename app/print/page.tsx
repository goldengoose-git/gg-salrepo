'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { SlideView } from '@/components/SlideView';
import { api } from '@/lib/client';
import { buildSlides } from '@/lib/slides';
import type { AppState } from '@/lib/types';

function Inner() {
  const sp = useSearchParams();
  const [st, setSt] = useState<AppState | null>(null);
  useEffect(() => { api<{ state: AppState }>('/api/state').then((r) => setSt(r.state)); }, []);
  useEffect(() => {
    if (!st) return;
    document.title = `GG_Weekly_SAL_${st.deck.week_label.replace(/\W+/g, '_')}`;
    if (sp.get('auto') === '1') setTimeout(() => window.print(), 1200);
  }, [st, sp]);
  if (!st) return <div style={{ padding: 20 }}>Preparo le slide…</div>;
  const slides = buildSlides(st, sp.get('archive') === '1');
  return (
    <>
      <div className="noprint" style={{ padding: 14, display: 'flex', gap: 12, alignItems: 'center', background: '#15171b', position: 'sticky', top: 0, zIndex: 5 }}>
        <button className="btn pri" onClick={() => window.print()}>Stampa / Salva come PDF</button>
        <span className="muted">Nel dialogo di stampa: destinazione &quot;Salva come PDF&quot;, margini &quot;Nessuno&quot;, attiva &quot;Grafica di sfondo&quot;.</span>
      </div>
      <div className="print-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: 20, alignItems: 'center' }}>
        {slides.map((s, i) => <SlideView key={i} s={s} deck={st.deck} />)}
      </div>
    </>
  );
}
export default function Print() { return <Suspense fallback={null}><Inner /></Suspense>; }
