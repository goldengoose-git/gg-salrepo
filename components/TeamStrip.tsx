'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { useApp } from './AppShell';

const NAME = { MC: 'Marketing Cloud', SC: 'Service Cloud' } as const;
const fmt = (iso: string) => new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function TeamStrip() {
  const { me, state, reload, toast } = useApp();
  const [seen, setSeen] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const other = me.role === 'MC' ? 'SC' : 'MC';
  const mine = state!.teamStatus.find((t) => t.team === me.role);
  const theirs = state!.teamStatus.find((t) => t.team === other);
  const key = theirs ? `sal-seen-${state!.deck.id}-${other}-${theirs.done_at}` : '';
  useEffect(() => { try { setSeen(key ? localStorage.getItem(key) ?? '' : ''); } catch { setSeen(''); } }, [key]);
  const dismiss = () => { try { localStorage.setItem(key, '1'); } catch {} setSeen('1'); };

  async function toggle() {
    if (!mine && !confirm('Segnare l\'editing come completato? Il team ' + NAME[other] + ' riceverà una notifica in alto su Azioni.')) return;
    setBusy(true);
    try { await api('/api/team-status', 'POST', { done: !mine }); await reload(); toast(mine ? 'Editing riaperto' : 'Editing segnato come completato'); } catch (e: any) { toast(e.message); }
    setBusy(false);
  }
  const chip = (team: 'MC' | 'SC') => {
    const t = state!.teamStatus.find((x) => x.team === team);
    return (
      <span key={team} className="opt" style={{ cursor: 'default', gap: 8, borderColor: t ? '#34A853' : undefined }}>
        <i style={{ width: 9, height: 9, borderRadius: '50%', background: t ? '#34A853' : '#E9A800', display: 'inline-block' }} />
        <b>{team}</b> {t ? `completato ${fmt(t.done_at)}` : 'in corso'}
      </span>
    );
  };
  return (
    <div className="noprint" style={{ padding: '10px 24px 0' }}>
      {theirs && !seen && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, marginBottom: 10, background: 'rgba(52,168,83,.14)', border: '1px solid #34A853' }}>
          <span style={{ fontSize: 20 }}>✓</span>
          <div style={{ flex: 1 }}><b>Il team {NAME[other]} ha completato l&apos;editing</b>
            <div className="muted" style={{ fontSize: 13 }}>{fmt(theirs.done_at)}{theirs.done_by ? ` · ${theirs.done_by}` : ''}. Le sue voci sono pronte per la verifica e l&apos;export.</div></div>
          <button className="btn" onClick={dismiss}>Ho visto</button>
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {chip('MC')}{chip('SC')}<span className="sp" />
        <button className={'btn' + (mine ? '' : ' pri')} disabled={busy} onClick={toggle}>{mine ? 'Riapri editing' : 'Segna editing completato'}</button>
      </div>
    </div>
  );
}
