const P: Record<string, string> = {
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  tix: 'M3 9a2 2 0 0 0 0 6v3h18v-3a2 2 0 0 1 0-6V6H3z',
  tl: 'M3 6h10M7 12h14M5 18h9',
  ar: 'M5 9v10h14V9M10 13h4M4 4h16v5H4z',
  pv: 'M3 4h18v13H3zM8 21h8M12 17v4',
  img: 'M3 4h18v16H3zM3 16l5-5 4 4 3-3 6 6M9 9h.01',
  plus: 'M12 5v14M5 12h14',
  ed: 'M4 20h4L19 9l-4-4L4 16z',
  x: 'M6 6l12 12M18 6L6 18',
  dl: 'M12 4v11M7 11l5 5 5-5M5 20h14',
  ck: 'M5 12l5 5 9-10',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  cp: 'M8 8h12v12H8zM4 16V4h12',
  tr: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  undo: 'M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
};
export function Ic({ n }: { n: keyof typeof P | string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={P[n]} />
    </svg>
  );
}
