'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/client';

export default function Login() {
  const [user, setUser] = useState<'mc' | 'sc'>('mc');
  const [pwd, setPwd] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function go(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    try { await api('/api/login', 'POST', { username: user, password: pwd }); router.push('/azioni'); router.refresh(); }
    catch (x: any) { setErr(x.message); setBusy(false); }
  }
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: '10px solid #E0301E', padding: 20 }}>
      <form onSubmit={go} className="card" style={{ width: 420, padding: 32, background: '#20232a' }}>
        <div className="logo m" style={{ fontSize: 20, paddingBottom: 18 }}><i />SAL Builder</div>
        <h1 className="m" style={{ margin: '0 0 6px', fontSize: 24 }}>Golden Goose Weekly SAL</h1>
        <p className="muted" style={{ margin: '0 0 22px' }}>Accedi come…</p>
        <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
          {(['mc', 'sc'] as const).map((u) => (
            <button type="button" key={u} onClick={() => setUser(u)}
              style={{ flex: 1, textAlign: 'left', padding: 14, borderRadius: 10, color: '#fff', border: user === u ? '2px solid #E0301E' : '1px solid #3a3e49', background: user === u ? '#2a2020' : '#252830' }}>
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
    </div>
  );
}
