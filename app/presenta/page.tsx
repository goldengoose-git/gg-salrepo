'use client';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SlideView, Thumb } from '@/components/SlideView';
import { Ic } from '@/components/icons';
import { api } from '@/lib/client';
import { buildSlides } from '@/lib/slides';
import type { AppState } from '@/lib/types';

// Presentazione a schermo intero: stesse slide dell'anteprima/PDF, frecce/spazio per scorrere, F schermo intero, G griglia, B schermo nero,
// cursore = punto rosso. ?s=N parte dalla slide N (1 = copertina), ?archive=0 esclude le Completed Activities.
function Inner() {
  const sp = useSearchParams();
  const router = useRouter();
  const [st, setSt] = useState<AppState | null>(null);
  const [i, setI] = useState(() => Math.max(0, (parseInt(sp.get('s') ?? '1', 10) || 1) - 1));
  const [vp, setVp] = useState({ w: 1280, h: 720 });
  const [grid, setGrid] = useState(false);
  const [black, setBlack] = useState(false);
  const [full, setFull] = useState(false);
  const [ui, setUi] = useState(true);
  const [dot, setDot] = useState<{ x: number; y: number } | null>(null);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touch = useRef<number | null>(null);

  useEffect(() => { api<{ state: AppState }>('/api/state').then((r) => setSt(r.state)).catch(() => router.push('/login')); }, [router]);
  const slides = st ? buildSlides(st, sp.get('archive') !== '0') : [];
  const n = slides.length;
  const go = useCallback((f: (x: number) => number) => setI((x) => Math.min(Math.max(0, f(x)), Math.max(0, n - 1))), [n]);

  useEffect(() => {
    const fit = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    fit(); window.addEventListener('resize', fit);
    const onFs = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('resize', fit); document.removeEventListener('fullscreenchange', onFs); document.body.style.overflow = ''; };
  }, []);
  useEffect(() => { document.title = st ? `Presenta · ${st.deck.week_label}` : 'Presenta'; }, [st]);
  useEffect(() => { if (st) history.replaceState(null, '', `?s=${i + 1}${sp.get('archive') === '0' ? '&archive=0' : ''}`); }, [i, st, sp]);

  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  }, []);
  const exit = useCallback(() => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); router.push('/anteprima'); }, [router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (grid) { if (k === 'Escape' || k === 'g' || k === 'G') { setGrid(false); e.preventDefault(); } return; }
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter', 'n', 'N'].includes(k)) { setBlack(false); go((x) => x + 1); e.preventDefault(); }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'p', 'P'].includes(k)) { setBlack(false); go((x) => x - 1); e.preventDefault(); }
      else if (k === 'Home') { go(() => 0); e.preventDefault(); }
      else if (k === 'End') { go(() => n - 1); e.preventDefault(); }
      else if (k === 'f' || k === 'F') { toggleFull(); e.preventDefault(); }
      else if (k === 'g' || k === 'G') { setGrid(true); e.preventDefault(); }
      else if (k === 'b' || k === 'B' || k === '.') { setBlack((x) => !x); e.preventDefault(); }
      else if (k === 'Escape') { if (black) setBlack(false); else if (!document.fullscreenElement) exit(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [grid, black, n, go, toggleFull, exit]);

  const wake = (x?: number, y?: number) => {
    setUi(true);
    if (x !== undefined && y !== undefined) setDot({ x, y });
    if (idle.current) clearTimeout(idle.current);
    idle.current = setTimeout(() => setUi(false), 2600);
  };
  useEffect(() => { wake(); return () => { if (idle.current) clearTimeout(idle.current); }; /* eslint-disable-next-line */ }, []);

  if (!st) return <div style={{ background: '#000', color: '#aaa', height: '100vh', display: 'grid', placeItems: 'center' }}>Preparo la presentazione…</div>;
  if (!n) return <div style={{ background: '#000', color: '#aaa', height: '100vh', display: 'grid', placeItems: 'center' }}>Nessuna slide.</div>;
  const k = Math.min(vp.w / 1280, vp.h / 720);
  const cur = Math.min(i, n - 1);

  return (
    <div className="pres" onMouseMove={(e) => wake(e.clientX, e.clientY)} onMouseLeave={() => setDot(null)}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; wake(); }}
      onTouchEnd={(e) => { if (touch.current === null) return; const dx = e.changedTouches[0].clientX - touch.current; touch.current = null; if (Math.abs(dx) > 50) go((x) => x + (dx < 0 ? 1 : -1)); }}>
      <div className="pres-stage" style={{ width: 1280 * k, height: 720 * k }}
        onClick={(e) => { if (grid) return; const r = e.currentTarget.getBoundingClientRect(); go((x) => x + (e.clientX - r.left < r.width * 0.25 ? -1 : 1)); setBlack(false); }}>
        <div style={{ width: 1280, height: 720, transform: `scale(${k})`, transformOrigin: '0 0', pointerEvents: 'none' }}>
          <SlideView s={slides[cur]} deck={st.deck} no={cur + 1} />
        </div>
      </div>
      {black && <div className="pres-black" onClick={() => setBlack(false)} />}
      {dot && !grid && <div className="pres-dot" style={{ left: dot.x, top: dot.y }} />}
      <div className={'pres-bar' + (ui ? '' : ' hide')} onClick={(e) => e.stopPropagation()}>
        <button title="Precedente (←)" onClick={() => go((x) => x - 1)} disabled={cur === 0}>‹</button>
        <span className="pres-n">{cur + 1} / {n}</span>
        <button title="Successiva (→ o spazio)" onClick={() => go((x) => x + 1)} disabled={cur === n - 1}>›</button>
        <i />
        <button title="Tutte le slide (G)" onClick={() => setGrid(true)}><Ic n="list" /></button>
        <button title="Schermo intero (F)" onClick={toggleFull}>{full ? 'Esci da schermo intero' : 'Schermo intero'}</button>
        <button title="Esci (Esc)" onClick={exit}><Ic n="x" /></button>
      </div>
      {grid && (
        <div className="pres-grid" onClick={() => setGrid(false)}>
          <div className="pres-grid-in" onClick={(e) => e.stopPropagation()}>
            {slides.map((s, j) => (
              <button key={j} className={j === cur ? 'on' : ''} onClick={() => { setI(j); setGrid(false); }}>
                <Thumb s={s} deck={st.deck} w={260} no={j + 1} /><span>{j + 1}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
export default function Presenta() { return <Suspense fallback={null}><Inner /></Suspense>; }
