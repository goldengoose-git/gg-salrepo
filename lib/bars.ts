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
