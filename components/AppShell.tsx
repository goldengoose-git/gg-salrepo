'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '@/lib/client';
import type { AppState, Me } from '@/lib/types';
import type { EnvInfo } from '@/lib/env-info';
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

const ADMIN_NAV = [
  { href: '/admin/backup', label: 'Backup e ripristino', ic: 'dl' },
  { href: '/admin/etichette', label: 'Colori ed Elenchi', ic: 'ed' },
  { href: '/admin/normalizza', label: 'Normalizza date', ic: 'undo' },
];
const isOn = (path: string, href: string) => path === href || path.startsWith(href + '/');

const ENV_NAME: Record<string, string> = { production: 'PRODUZIONE', preview: 'PREVIEW / TEST', development: 'SVILUPPO', local: 'LOCALE' };
function EnvBar({ me, env }: { me: Me; env: EnvInfo }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  const since = me.iat ? me.iat * 1000 : null;
  const mins = since ? Math.max(0, Math.floor((now - since) / 60000)) : null;
  const dur = mins === null ? '' : mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} h ${mins % 60} min`;
  const prod = env.env === 'production';
  const fmt = (t: number) => new Date(t).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return (
    <div className="noprint" role="status" style={{ background: prod ? '#B3261E' : env.env === 'preview' ? '#B26A00' : '#2F5D8A', color: '#fff', font: '600 12.5px Montserrat, sans-serif', padding: '6px 24px', display: 'flex', gap: '4px 18px', flexWrap: 'wrap', alignItems: 'center' }}>
      <b style={{ letterSpacing: '.04em' }}>{ENV_NAME[env.env] ?? env.env.toUpperCase()}</b>
      {env.gitBranch && <span>branch: {env.gitBranch}{env.commit ? ` @ ${env.commit}` : ''}</span>}
      {me.role === 'ADMIN' && <span>DB: {env.dbEndpoint}{env.dbLabel ? ` (${env.dbLabel})` : ''}</span>}
      <span>utente: {me.name} ({me.username}, {me.role})</span>
      {since && <span>login dal {fmt(since)} · da {dur}</span>}
    </div>
  );
}

export default function AppShell({ me, env, children }: { me: Me; env: EnvInfo; children: React.ReactNode }) {
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
            <Link key={n.href} href={n.href} className={'nav' + (isOn(path, n.href) ? ' on' : '')} aria-current={isOn(path, n.href) ? 'page' : undefined}><Ic n={n.ic} />{n.label}</Link>
          ))}
          {me.role === 'ADMIN' && (
            <div className="adm">
              <div className="lab" style={{ padding: '0 10px 6px' }}>Admin All</div>
              {ADMIN_NAV.map((n) => (
                <Link key={n.href} href={n.href} className={'nav' + (isOn(path, n.href) ? ' on' : '')} aria-current={isOn(path, n.href) ? 'page' : undefined}><Ic n={n.ic} />{n.label}</Link>
              ))}
            </div>
          )}
          <div className="who">
            <b style={{ color: 'var(--fgb)' }}>{me.name}</b><br />{me.role === 'ADMIN' ? 'Admin All · vede e scrive tutto' : me.role === 'MC' ? 'Marketing Cloud' : 'CRM e Service Cloud'}
            <div style={{ marginTop: 10 }}><ThemeToggle style={{ height: 28, fontSize: 12.5 }} /></div>
            <button onClick={async () => { await api('/api/logout', 'POST'); router.push('/login'); router.refresh(); }}>Esci</button>
          </div>
        </aside>
        <div className="main"><EnvBar me={me} env={env} />{state ? <>{me.role !== 'ADMIN' && (path.startsWith('/azioni') || path.startsWith('/ticket')) && <TeamStrip />}{children}</> : <div className="body muted">Caricamento…</div>}</div>
      </div>
      {msg && <div className="toast">{msg}</div>}
    </C.Provider>
  );
}
