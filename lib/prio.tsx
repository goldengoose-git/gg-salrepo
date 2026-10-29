// Icone priorità in stile Jira (chevron). Usate in tabelle, modali e slide HTML.
export const PRIO: Record<string, { c: string; k: 'u2' | 'u1' | 'eq' | 'd1' | 'd2'; glyph: string }> = {
  Highest: { c: '#FF5630', k: 'u2', glyph: '⌃⌃' },
  High: { c: '#FF7452', k: 'u1', glyph: '⌃' },
  Medium: { c: '#FFAB00', k: 'eq', glyph: '=' },
  Low: { c: '#2684FF', k: 'd1', glyph: '⌄' },
  Lowest: { c: '#0065FF', k: 'd2', glyph: '⌄⌄' },
};
const PATH: Record<string, string> = {
  u2: 'M5 12l7-7 7 7M5 20l7-7 7 7',
  u1: 'M5 16l7-7 7 7',
  eq: 'M5 9h14M5 15h14',
  d1: 'M5 9l7 7 7-7',
  d2: 'M5 4l7 7 7-7M5 12l7 7 7-7',
};
export const prioKey = (p: string) => Object.keys(PRIO).find((k) => k.toLowerCase() === String(p || '').trim().toLowerCase());

export function PrioIcon({ p, size = 14 }: { p: string; size?: number }) {
  const k = prioKey(p);
  if (!k) return null;
  const d = PRIO[k];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flex: 'none', verticalAlign: '-2px' }}>
      <path d={PATH[d.k]} fill="none" stroke={d.c} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function Prio({ p, size = 14, gap = 5 }: { p: string; size?: number; gap?: number }) {
  if (!p) return null;
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap, whiteSpace: 'nowrap' }}><PrioIcon p={p} size={size} />{p}</span>;
}
