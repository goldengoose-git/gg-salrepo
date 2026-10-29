import { fmtEstimate } from './lookups';
import { COLS, Col, MAX_ROWS, STATUS, type BarStatus, type Lane, type Status } from './constants';
import type { AppState, Item } from './types';

export type SRow = { cells: string[]; status?: Status; completed?: boolean; ams?: { t: string; tag: string }[] };
export type PBar = { label: string; status: BarStatus; start: number; end: number; row: number; out: 'in' | 'right' | 'left' };
export type PLane = { label: Lane; rows: number; bars: PBar[] };
export type Slide =
  | { kind: 'cover' }
  | { kind: 'section'; title: string }
  | { kind: 'closing' }
  | { kind: 'table'; theme: 'mc' | 'sc' | 'ams' | 'completed'; title: string; part: string; columns: Col[]; rows: SRow[]; statusCol: number; prioCol: number; legend: boolean }
  | { kind: 'pipeline'; title: string; part: string; year: number; today: number; lanes: PLane[] };

const chunk = <T,>(a: T[], n: number) => {
  const out: T[][] = [];
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n));
  return out.length ? out : [[]];
};
const sLabel = (s: Status) => STATUS[s].label;

// ---- paginazione: max 12 righe, ma anche solo quante ne stanno sopra la riga di chiusura ----
const TABLE_W = 1190, BODY_H = 536;
function estRowH(columns: Col[], cells: string[]) {
  const tot = columns.reduce((a, c) => a + c.w, 0);
  let lines = 1;
  cells.forEach((t, i) => {
    const px = (columns[i].w / tot) * TABLE_W - 16;
    const cpl = Math.max(4, Math.floor(px / 6.4));
    const l = String(t ?? '').split('\n').reduce((a, seg) => a + Math.max(1, Math.ceil(seg.length / cpl)), 0);
    if (l > lines) lines = l;
  });
  return Math.max(44, lines * 16 + 14);
}
function paginate<T>(items: T[], heightOf: (x: T) => number): T[][] {
  const pages: T[][] = [];
  let cur: T[] = [], acc = 0;
  for (const it of items) {
    const h = heightOf(it);
    if (cur.length && (cur.length >= MAX_ROWS || acc + h > BODY_H)) { pages.push(cur); cur = []; acc = 0; }
    cur.push(it); acc += h;
  }
  if (cur.length || !pages.length) pages.push(cur);
  return pages;
}

export function todayPos(d = new Date()) {
  const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return Math.round((d.getMonth() + (d.getDate() - 1) / dim) * 100) / 100;
}

// ---- timeline: assegna le righe tenendo conto anche dell'ingombro dell'etichetta ----
const CHAR_W = 7.0; // px per carattere a ~11px (stima)
export function layoutBars(
  bars: { label: string; status: BarStatus; start_m: number; end_m: number }[],
  TLW = 1150,
  cw = CHAR_W
): { bars: PBar[]; rows: number } {
  const items = bars.map((b) => {
    const xs = (b.start_m / 12) * TLW, xe = (b.end_m / 12) * TLW;
    const lw = b.label.length * cw + 14;
    let out: PBar['out'] = 'in', a = xs, e = xe;
    if (lw > xe - xs) {
      if (xe + 6 + lw <= TLW + 4) { out = 'right'; e = xe + 6 + lw; }
      else { out = 'left'; a = Math.max(0, xs - 6 - lw); }
    }
    return { b, xs, xe, out, a, e };
  });
  items.sort((x, y) => x.a - y.a || x.e - y.e);
  const ends: number[] = [];
  const res: PBar[] = [];
  for (const it of items) {
    let r = ends.findIndex((e) => e + 4 <= it.a);
    if (r < 0) { r = ends.length; ends.push(0); }
    ends[r] = it.e;
    res.push({ label: it.b.label, status: it.b.status, start: it.b.start_m, end: it.b.end_m, row: r, out: it.out });
  }
  return { bars: res, rows: Math.max(1, ends.length) };
}
export const PIPE = { top: 114, bottom: 676, laneGap: 12, minPitch: 14, maxPitch: 24 };
export const pipePitch = (rows: number, lanes: number) =>
  Math.max(11, Math.min(PIPE.maxPitch, (PIPE.bottom - PIPE.top - lanes * PIPE.laneGap) / Math.max(1, rows)));

const SEV: Status[] = ['blocked', 'delay', 'onhold', 'ontrack'];

export function buildSlides(st: AppState, includeArchive = false): Slide[] {
  const active = (a: Item['area']) => st.items.filter((i) => i.area === a && !i.archived_at).sort((x, y) => x.position - y.position);
  const slides: Slide[] = [{ kind: 'cover' }, { kind: 'section', title: st.deck.subtitle || 'Status Update' }];

  const cellsOf = (theme: 'mc' | 'sc', it: Item, n: string) => {
    const act = it.activity || sLabel(it.status);
    return theme === 'mc'
      ? [n, it.type, it.description, it.priority, it.requested_date, it.golive_date, it.owner, fmtEstimate(it.estimate), it.contract, act]
      : [n, it.description, it.priority, it.requested_date, it.golive_date, it.owner, fmtEstimate(it.estimate), it.contract, act];
  };
  const tableSlides = (theme: 'mc' | 'sc', title: string, items: Item[]) => {
    const cols = COLS[theme];
    const pages = paginate(items, (it) => estRowH(cols, cellsOf(theme, it, '00')));
    let n0 = 0;
    pages.forEach((page, p) => {
      const rows: SRow[] = page.map((it, k) => ({ cells: cellsOf(theme, it, String(n0 + k + 1)), status: it.status }));
      n0 += page.length;
      slides.push({
        kind: 'table', theme, title, part: pages.length > 1 ? `${p + 1}/${pages.length}` : '', columns: cols, rows,
        statusCol: cols.length - 1, prioCol: cols.findIndex((c) => c.name === 'Priorità'), legend: true,
      });
    });
  };
  tableSlides('mc', 'Action points & Next Steps – Marketing Cloud', active('MC'));
  const scItems = active('SC');
  tableSlides('sc', 'Action points & Next Steps – CRM & Service Cloud', scItems);

  // Ticket AMS: un unico blocco (una sola riga/ID) con l'elenco dei ticket, come nella slide originale
  const ams = active('AMS');
  if (ams.length) {
    const pages = chunk(ams, 18);
    pages.forEach((page, p) => {
      const worst = SEV.find((s) => page.some((i) => i.status === s)) ?? 'ontrack';
      const contract = page.find((i) => i.contract)?.contract ?? '';
      slides.push({
        kind: 'table', theme: 'ams', title: 'Action points & Next Steps – CRM & Service Cloud', part: pages.length > 1 ? `AMS ${p + 1}/${pages.length}` : 'AMS',
        columns: COLS.amsblock, statusCol: 4, prioCol: -1, legend: true,
        rows: [{
          status: worst,
          cells: [String(scItems.length + 1), 'Ticket AMS', '', contract, sLabel(worst)],
          ams: page.map((i) => ({ t: `${i.code ? i.code + ' - ' : ''}${i.description}`, tag: i.activity || sLabel(i.status) })),
        }],
      });
    });
  }

  // Pipeline: righe calcolate anche sull'etichetta; lane distribuite su più slide se troppo dense
  const lanes: PLane[] = (['SFMC', 'CROSS', 'SFSC'] as Lane[]).map((label) => {
    const l = layoutBars(st.bars.filter((b) => b.lane === label), 1170);
    return { label, rows: l.rows, bars: l.bars };
  });
  const groups: PLane[][] = [];
  let cur: PLane[] = [];
  let curRows = 0;
  const cap = (PIPE.bottom - PIPE.top) / PIPE.minPitch;
  for (const l of lanes) {
    const need = l.rows + PIPE.laneGap / PIPE.minPitch;
    if (cur.length && curRows + need > cap) { groups.push(cur); cur = []; curRows = 0; }
    cur.push(l); curRows += need;
  }
  if (cur.length) groups.push(cur);
  groups.forEach((g, i) =>
    slides.push({ kind: 'pipeline', title: 'Pipeline', part: groups.length > 1 ? `${i + 1}/${groups.length}` : '', year: st.deck.year, today: todayPos(), lanes: g })
  );

  if (includeArchive) {
    const arch = st.items.filter((i) => i.archived_at).sort((a, b) => +new Date(b.closed_at ?? b.archived_at!) - +new Date(a.closed_at ?? a.archived_at!));
    if (arch.length) {
      const cc = (it: Item) => [it.area === 'AMS' ? 'AMS' : it.type, it.area === 'AMS' ? `${it.code} – ${it.description}` : it.description, it.priority, it.golive_date, it.owner, fmtEstimate(it.estimate), it.contract, 'Done'];
      const pages = paginate(arch, (it) => estRowH(COLS.completed, cc(it)));
      pages.forEach((page, p, all) => {
        slides.push({
          kind: 'table', theme: 'completed', title: 'Completed Activities', part: all.length > 1 ? `${p + 1}/${all.length}` : '',
          columns: COLS.completed, statusCol: 7, prioCol: 2, legend: false,
          rows: page.map((it) => ({ completed: true, status: 'completed' as Status, cells: cc(it) })),
        });
      });
    }
  }
  slides.push({ kind: 'closing' });
  return slides;
}
