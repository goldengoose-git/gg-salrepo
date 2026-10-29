'use client';
import { useEffect, useState } from 'react';

export default function ThemeToggle({ style }: { style?: React.CSSProperties }) {
  const [t, setT] = useState<'dark' | 'light'>('dark');
  useEffect(() => { setT((document.documentElement.dataset.theme as any) || 'dark'); }, []);
  function flip() {
    const n = t === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = n; setT(n);
    try { localStorage.setItem('sal-theme', n); } catch {}
  }
  return (
    <button type="button" className="btn" onClick={flip} style={{ height: 32, ...style }} title="Cambia tema">
      {t === 'dark' ? '☀ Chiaro' : '☾ Scuro'}
    </button>
  );
}
