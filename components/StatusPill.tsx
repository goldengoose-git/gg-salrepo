'use client';
import { AMS_STATUS, BAR_STATUS, STATUS, type AmsStatus, type BarStatus, type Status } from '@/lib/constants';
import { uiAms, uiBar, uiStatus } from '@/lib/ui-colors';
import { useApp } from './AppShell';

// Colori: quelli personalizzati da Admin All (solo interfaccia interna); slide, PPTX e PDF usano sempre constants.ts.
export function StatusPill({ s }: { s: Status }) {
  const c = uiStatus(useApp().state?.uiColors, s);
  return <span className="pill" style={{ background: c.color, color: c.text }}>{STATUS[s].label}</span>;
}
export function AmsPill({ s }: { s: AmsStatus }) {
  const c = uiAms(useApp().state?.uiColors, s);
  return <span className="pill" style={{ background: c.color, color: c.text }}>{AMS_STATUS[s].label}</span>;
}
/** Stato da mostrare per una voce: Jira per i ticket AMS, altrimenti Activity status. */
export function ItemPill({ i }: { i: { area: string; status: Status; ams_status: AmsStatus | null } }) {
  return i.area === 'AMS' && i.ams_status ? <AmsPill s={i.ams_status} /> : <StatusPill s={i.status} />;
}
export function BarPill({ s }: { s: BarStatus }) {
  const c = uiBar(useApp().state?.uiColors, s);
  return <span className="pill" style={{ background: c.color, color: c.text }}>{BAR_STATUS[s].label}</span>;
}
