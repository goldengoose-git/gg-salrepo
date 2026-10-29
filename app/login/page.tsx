'use client';
import { useEffect, useState } from 'react';
import ThemeToggle from '@/components/ThemeToggle';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';

export default function Login() {
  const [user, setUser] = useState<'mc' | 'sc'>('mc');
  const [pwd, setPwd] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [logo, setLogo] = useState<string | null>(null);
  const router = useRouter();
  useEffect(() => { fetch('/api/branding').then((r) => r.json()).then((j) => setLogo(j.login_logo_url)).catch(() => {}); }, []);
  async function go(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    try { await api('/api/login', 'POST', { username: user, password: pwd }); router.push('/azioni'); router.refresh(); }
    catch (x: any) { setErr(x.message); setBusy(false); }
  }
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: '10px solid #E0301E', padding: 20 }}>
      <form onSubmit={go} className="card" style={{ width: 420, padding: 32, background: 'var(--th)' }}>
        {logo
          ? <div style={{ background: '#fff', borderRadius: 10, padding: '10px 14px', marginBottom: 20, display: 'inline-block' }}><img src={logo} alt="" style={{ display: 'block', maxHeight: 56, maxWidth: 260, objectFit: 'contain' }} /></div>
          : <div className="logo m" style={{ fontSize: 20, paddingBottom: 18 }}><i />SAL Builder</div>}
        <h1 className="m" style={{ margin: '0 0 6px', fontSize: 24 }}>Golden Goose Weekly SAL</h1>
        <p className="muted" style={{ margin: '0 0 22px' }}>Accedi come…</p>
        <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
          {(['mc', 'sc'] as const).map((u) => (
            <button type="button" key={u} onClick={() => setUser(u)}
              style={{ flex: 1, textAlign: 'left', padding: 14, borderRadius: 10, color: 'var(--fgb)', border: user === u ? '2px solid #E0301E' : '1px solid var(--line2)', background: user === u ? 'var(--sel)' : 'var(--panel)' }}>
              <b className="m">{u.toUpperCase()}</b>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>{u === 'mc' ? 'Marketing Cloud' : 'Service Cloud + AMS'}</div>
            </button>
          ))}
        </div>
        <div className="lab" style={{ marginBottom: 6 }}>Password</div>
        <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} autoFocus required />
        {err && <div className="err" style={{ marginTop: 10 }}>{err}</div>}
        <button className="btn pri" disabled={busy} style={{ width: '100%', justifyContent: 'center', height: 42, marginTop: 20 }}>{busy ? 'Accesso…' : 'Entra'}</button>
      </form>
      <div style={{ position: 'fixed', top: 16, right: 16 }}><ThemeToggle /></div>
    </div>
  );
}
