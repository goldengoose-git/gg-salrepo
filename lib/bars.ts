import { BAR_STATUS } from './constants';

export function cleanBar(b: any) {
  const n = (x: any, d: number) => (Number.isFinite(+x) ? Math.max(0, Math.min(12, +x)) : d);
  const start = n(b.start_m, 0);
  let end = n(b.end_m, start + 1);
  if (end <= start) end = Math.min(12, start + 0.3);
  return {
    label: String(b.label ?? '').slice(0, 300),
    status: b.status in BAR_STATUS ? b.status : 'wip',
    start_m: start, end_m: end,
  };
}

/** Prima riga della lane in cui l'intervallo [start,end] non si sovrappone ad altre barre. */
export function freeRow(others: { row: number; start_m: number; end_m: number }[], start: number, end: number) {
  const used = (r: number) => others.some((o) => o.row === r && o.start_m < end + 0.04 && start < o.end_m + 0.04);
  let r = 0;
  while (used(r)) r++;
  return r;
}
