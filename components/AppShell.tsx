'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '@/lib/client';
import type { AppState, Me } from '@/lib/types';
import { Ic } from './icons';
import ThemeToggle from './ThemeToggle';
import TeamStrip from './TeamStrip';

type Ctx = { me: Me; state: AppState | null; reload: () => Promise<void>; toast: (m: string) => void };
const C = createContext<Ctx>(null as any);
export const useApp = () => useContext(C);

const NAV = [
  { href: '/azioni', label: 'Azioni', ic: 'list' },
  { href: '/ticket', label: 'Ticket AMS', ic: 'tix' },
  { href: '/timeline', label: 'Timeline', ic: 'tl' },
  { href: '/archivio', label: 'Archivio', ic: 'ar' },
  { href: '/anteprima', label: 'Anteprima ed export', ic: 'pv' },
  { href: '/elenchi', label: 'Elenchi (Type, Owner)', ic: 'list' },
  { href: '/impostazioni', label: 'Sfondi e loghi', ic: 'img' },
];

export default function AppShell({ me, children }: { me: Me; children: React.ReactNode }) {
  const [state, setState] = useState<AppState | null>(null);
  const [msg, setMsg] = useState('');
  const path = usePathname();
  const router = useRouter();
  const reload = useCallback(async () => {
    try { setState((await api<{ state: AppState }>('/api/state')).state); } catch (e: any) { setMsg(e.message); }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  // aggiorna ogni minuto (e al ritorno sulla scheda) per vedere subito l'editing completato dall'altro team
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') reload(); }, 60000);
    const v = () => { if (document.visibilityState === 'visible') reload(); };
    document.addEventListener('visibilitychange', v);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', v); };
  }, [reload]);
  const toast = useCallback((m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3500); }, []);

  return (
    <C.Provider value={{ me, state, reload, toast }}>
      <div className="app">
        <aside className="side noprint">
          <div className="logo m"><i />SAL Builder</div>
          <div className="lab" style={{ padding: '0 10px 8px' }}>{state?.deck.week_label ?? '…'}</div>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={'nav' + (path.startsWith(n.href) ? ' on' : '')}><Ic n={n.ic} />{n.label}</Link>
          ))}
          <div className="who">
            <b style={{ color: 'var(--fgb)' }}>{me.name}</b><br />{me.role === 'MC' ? 'Marketing Cloud' : 'CRM e Service Cloud'}
            <div style={{ marginTop: 10 }}><ThemeToggle style={{ height: 28, fontSize: 12.5 }} /></div>
            <button onClick={async () => { await api('/api/logout', 'POST'); router.push('/login'); router.refresh(); }}>Esci</button>
          </div>
        </aside>
        <div className="main">{state ? <>{(path.startsWith('/azioni') || path.startsWith('/ticket')) && <TeamStrip />}{children}</> : <div className="body muted">Caricamento…</div>}</div>
      </div>
      {msg && <div className="toast">{msg}</div>}
    </C.Provider>
  );
}
