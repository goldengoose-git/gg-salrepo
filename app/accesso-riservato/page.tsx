'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';
import { api } from '@/lib/client';

// Accesso Admin All: nessun link da altre pagine. L'utente e fisso (admin), si inserisce solo la password.
export default function AccessoRiservato() {
  const [pwd, setPwd] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function go(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    try { await api('/api/login', 'POST', { username: 'admin', password: pwd, admin: true }); router.push('/admin/backup'); router.refresh(); }
    catch (x: any) { setErr(x.message); setBusy(false); }
  }
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: '10px solid #1F2020', padding: 20 }}>
      <form onSubmit={go} className="card" style={{ width: 380, padding: 32, background: 'var(--th)' }}>
        <div className="logo m" style={{ fontSize: 20, paddingBottom: 18 }}><i />SAL Builder</div>
        <h1 className="m" style={{ margin: '0 0 22px', fontSize: 22 }}>Accesso riservato</h1>
        <label className="lab" htmlFor="pw" style={{ display: 'block', marginBottom: 6 }}>Password</label>
        <input id="pw" type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} autoFocus required autoComplete="current-password" />
        {err && <div className="err" style={{ marginTop: 10 }}>{err}</div>}
        <button className="btn pri" disabled={busy} style={{ width: '100%', justifyContent: 'center', height: 42, marginTop: 20 }}>{busy ? 'Accesso…' : 'Entra'}</button>
      </form>
      <div style={{ position: 'fixed', top: 16, right: 16 }}><ThemeToggle /></div>
    </div>
  );
}
