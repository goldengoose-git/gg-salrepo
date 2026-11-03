import { AMS_STATUS, BAR_STATUS, STATUS, type AmsStatus, type BarStatus, type Status } from '@/lib/constants';

export function StatusPill({ s }: { s: Status }) {
  return <span className="pill" style={{ background: STATUS[s].color, color: STATUS[s].text }}>{STATUS[s].label}</span>;
}
export function AmsPill({ s }: { s: AmsStatus }) {
  return <span className="pill" style={{ background: AMS_STATUS[s].color, color: AMS_STATUS[s].text }}>{AMS_STATUS[s].label}</span>;
}
/** Stato da mostrare per una voce: Jira per i ticket AMS, altrimenti Activity status. */
export function ItemPill({ i }: { i: { area: string; status: Status; ams_status: AmsStatus | null } }) {
  return i.area === 'AMS' && i.ams_status ? <AmsPill s={i.ams_status} /> : <StatusPill s={i.status} />;
}
export function BarPill({ s }: { s: BarStatus }) {
  return <span className="pill" style={{ background: BAR_STATUS[s].color, color: BAR_STATUS[s].text }}>{BAR_STATUS[s].label}</span>;
}
