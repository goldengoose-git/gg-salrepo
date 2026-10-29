import { BAR_STATUS, STATUS, type BarStatus, type Status } from '@/lib/constants';

export function StatusPill({ s }: { s: Status }) {
  return <span className="pill" style={{ background: STATUS[s].color, color: STATUS[s].text }}>{STATUS[s].label}</span>;
}
export function BarPill({ s }: { s: BarStatus }) {
  return <span className="pill" style={{ background: BAR_STATUS[s].color, color: BAR_STATUS[s].text }}>{BAR_STATUS[s].label}</span>;
}
