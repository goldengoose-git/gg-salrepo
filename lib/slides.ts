import { COLS, Col, MAX_ROWS, STATUS, type BarStatus, type Lane, type Status } from './constants';
import type { AppState, Item } from './types';

export type SRow = { cells: string[]; status?: Status; completed?: boolean };
export type Slide =
  | { kind: 'cover' }
  | { kind: 'section'; title: string }
  | { kind: 'closing' }
  | { kind: 'table'; theme: 'mc' | 'sc' | 'ams' | 'completed'; title: string; part: string; columns: Col[]; rows: SRow[]; statusCol: number; prioCol: number; legend: boolean }
  | { kind: 'pipeline'; title: string; year: number; today: number; lanes: { label: Lane; bars: { label: string; status: BarStatus; start: number; end: number; row: number }[] }[] };

const chunk = <T,>(a: T[], n: number) => {
  const out: T[][] = [];
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n));
  return out.length ? out : [[]];
};
const sLabel = (s: Status) => STATUS[s].label;

export function todayPos(d = new Date()) {
  const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return Math.round((d.getMonth() + (d.getDate() - 1) / dim) * 100) / 100;
}

// assegna le righe della timeline evitando sovrapposizioni
export function packRows<T extends { start_m: number; end_m: number; row?: number }>(bars: T[]) {
  const sorted = [...bars].sort((a, b) => a.start_m - b.start_m);
  const rowEnds: number[] = [];
  const out = new Map<T, number>();
  for (const b of sorted) {
    let r = rowEnds.findIndex((e) => e <= b.start_m + 0.001);
    if (r < 0) { r = rowEnds.length; rowEnds.push(0); }
    rowEnds[r] = b.end_m;
    out.set(b, r);
  }
  return out;
}

export function buildSlides(st: AppState, includeArchive = false): Slide[] {
  const active = (a: Item['area']) => st.items.filter((i) => i.area === a && !i.archived_at).sort((x, y) => x.position - y.position);
  const slides: Slide[] = [{ kind: 'cover' }, { kind: 'section', title: st.deck.subtitle || 'Status Update' }];

  const tableSlides = (theme: 'mc' | 'sc' | 'ams', title: string, items: Item[]) => {
    const cols = COLS[theme];
    const pages = chunk(items, MAX_ROWS);
    pages.forEach((page, p) => {
      const rows: SRow[] = page.map((it, k) => {
        const n = String(p * MAX_ROWS + k + 1);
        const st_ = sLabel(it.status);
        const cells =
          theme === 'mc' ? [n, it.type, it.description, it.priority, it.requested_date, it.golive_date, it.owner, it.estimate, it.contract, st_]
          : theme === 'sc' ? [n, it.description, it.priority, it.requested_date, it.golive_date, it.owner, it.estimate, it.contract, st_]
          : [n, it.code, it.description, it.priority, it.owner, it.requested_date, st_];
        return { cells, status: it.status };
      });
      slides.push({
        kind: 'table', theme, title, part: pages.length > 1 ? `${p + 1}/${pages.length}` : '', columns: cols, rows,
        statusCol: cols.length - 1, prioCol: cols.findIndex((c) => c.name === 'Priorità'), legend: true,
      });
    });
  };
  tableSlides('mc', 'Action points & Next Steps – Marketing Cloud', active('MC'));
  tableSlides('sc', 'Action points & Next Steps – CRM & Service Cloud', active('SC'));
  const ams = active('AMS');
  if (ams.length) tableSlides('ams', 'AMS – Ticket aperti', ams);

  const lanes = (['SFMC', 'CROSS', 'SFSC'] as Lane[]).map((label) => {
    const bs = st.bars.filter((b) => b.lane === label);
    const packed = packRows(bs);
    return { label, bars: bs.map((b) => ({ label: b.label, status: b.status, start: b.start_m, end: b.end_m, row: packed.get(b) ?? 0 })) };
  });
  slides.push({ kind: 'pipeline', title: 'Pipeline', year: st.deck.year, today: todayPos(), lanes });

  if (includeArchive) {
    const arch = st.items.filter((i) => i.archived_at).sort((a, b) => +new Date(b.closed_at ?? b.archived_at!) - +new Date(a.closed_at ?? a.archived_at!));
    if (arch.length) {
      chunk(arch, MAX_ROWS).forEach((page, p, all) => {
        slides.push({
          kind: 'table', theme: 'completed', title: 'Completed Activities', part: all.length > 1 ? `${p + 1}/${all.length}` : '',
          columns: COLS.completed, statusCol: 7, prioCol: 2, legend: false,
          rows: page.map((it) => ({
            completed: true, status: 'completed' as Status,
            cells: [it.area === 'AMS' ? 'AMS' : it.type, it.area === 'AMS' ? `${it.code} – ${it.description}` : it.description, it.priority, it.golive_date, it.owner, it.estimate, it.contract, 'Done'],
          })),
        });
      });
    }
  }
  slides.push({ kind: 'closing' });
  return slides;
}
