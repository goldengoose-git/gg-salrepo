import { fmtEstimate } from './lookups';
import { AMS_STATUS, COLS, Col, MAX_ROWS, STATUS, type BarStatus, type Lane, type Status } from './constants';
import type { AppState, Item } from './types';

export type SRow = { cells: string[]; status?: Status; completed?: boolean; ams?: { t: string; tag: string }[] };
export type PBar = { label: string; status: BarStatus; start: number; end: number; row: number; out: 'in' | 'right' | 'left' };
export type PLane = { label: Lane; rows: number; bars: PBar[] };
export type Slide =
  | { kind: 'cover' }
  | { kind: 'section'; title: string }
  | { kind: 'closing' }
  | { kind: 'table'; theme: 'mc' | 'sc' | 'ams' | 'completed'; title: string; part: string; columns: Col[]; rows: SRow[]; statusCol: number; prioCol: number; legend: boolean; tier?: 0 | 1 | 2 }
  | { kind: 'pipeline'; title: string; part: string; year: number; today: number; lanes: PLane[] };

const chunk = <T,>(a: T[], n: number) => {
  const out: T[][] = [];
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n));
  return out.length ? out : [[]];
};
const sLabel = (s: Status) => STATUS[s].label;

// ---- paginazione: si contano tutte le voci e si riempiono le slide fino a 12 righe (almeno 11 quando i dati lo permettono) ----
// Tre livelli di corpo: 12,5 px (preferito), 11,5 px, 11 px (minimo). Si sceglie il piu grande che tiene le righe sulla slide;
// poi la tabella viene distribuita fino a poco sopra il footer. L'ultima slide non resta con poche righe: si riportano righe
// dalla precedente finche questa resta >= 11.
export type Tier = 0 | 1 | 2;
const TABLE_W = 1190, MIN_ROWS = 11, MIN_LAST = 5;
export const FIT_H = 586;
export const FIT_FULL = 11; // da 11 righe in su la slide e "piena": righe distribuite fino al footer; sotto, altezza riga fissa (come sulle slide piene)
export const FIT_ROW = 45; // altezza della tabella (intestazione inclusa) nelle slide a righe distribuite
export const TIERS = [
  { cap: MAX_ROWS, font: 12.5, body: 538, charW: 5.5, lh: 15.6, pad: 6, min: 28, padX: 18 },
  { cap: MAX_ROWS, font: 11.5, body: 538, charW: 5.1, lh: 14.4, pad: 6, min: 28, padX: 18 },
  { cap: MAX_ROWS, font: 11, body: 538, charW: 4.95, lh: 13.8, pad: 6, min: 28, padX: 18 },
] as const;
function estRowH(columns: Col[], cells: string[], tier: Tier = 0) {
  const T = TIERS[tier];
  const tot = columns.reduce((a, c) => a + c.w, 0);
  let lines = 1;
  cells.forEach((t, i) => {
    const px = (columns[i].w / tot) * TABLE_W - T.padX;
    const cpl = Math.max(4, Math.floor(px / T.charW));
    const l = String(t ?? '').replace(/\*\*/g, '').split('\n').reduce((a, seg) => a + Math.max(1, Math.ceil(seg.length / cpl)), 0);
    if (l > lines) lines = l;
  });
  return Math.max(T.min, lines * T.lh + T.pad);
}
function paginate<T>(items: T[], heightOf: (x: T) => number, tier: Tier = 0, capOverride?: number): T[][] {
  const cap = capOverride ?? TIERS[tier].cap, budget = TIERS[tier].body;
  const pages: T[][] = [];
  let cur: T[] = [], acc = 0;
  for (const it of items) {
    const h = heightOf(it);
    if (cur.length && (cur.length >= cap || acc + h > budget)) { pages.push(cur); cur = []; acc = 0; }
    cur.push(it); acc += h;
  }
  if (cur.length || !pages.length) pages.push(cur);
  return pages;
}
function paginateSmart<T>(items: T[], heightOf: (x: T, tier: Tier) => number): { pages: T[][]; tier: Tier } {
  const cand = ([0, 1, 2] as Tier[]).map((tier) => {
    const h = (x: T) => heightOf(x, tier);
    const pages = paginate(items, h, tier);
    // l'ultima slide non deve restare con poche righe: si spostano righe dalla precedente (che resta >= MIN_ROWS)
    for (let i = pages.length - 1; i > 0; i--) {
      while (pages[i].length < MIN_LAST && pages[i - 1].length > MIN_ROWS) {
        const mv = pages[i - 1][pages[i - 1].length - 1];
        const hh = [mv, ...pages[i]].reduce((a, x) => a + h(x), 0);
        if (hh > TIERS[tier].body) break;
        pages[i - 1].pop(); pages[i].unshift(mv);
      }
    }
    const shortN = pages.length > 1 ? pages.filter((p) => p.length < MIN_ROWS).length : 0;
    return { pages, tier, key: [shortN, pages.length, tier] };
  });
  cand.sort((x, y) => x.key[0] - y.key[0] || x.key[1] - y.key[1] || x.key[2] - y.key[2]);
  return { pages: cand[0].pages, tier: cand[0].tier };
}

export function todayPos(d = new Date()) {
  const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return Math.round((d.getMonth() + (d.getDate() - 1) / dim) * 100) / 100;
}

// ---- timeline: assegna le righe tenendo conto anche dell'ingombro dell'etichetta ----
const CHAR_W = 7.0; // px per carattere a ~11px (stima)
export function layoutBars(
  bars: { label: string; status: BarStatus; start_m: number; end_m: number; row?: number }[],
  _TLW = 1150,
  _cw = CHAR_W
): { bars: PBar[]; rows: number } {
  // La riga salvata (row) viene rispettata, come nel deck originale. Se due barre si sovrappongono
  // sulla stessa riga (dati vecchi o attività create senza riga), quella più corta scende alla prima riga libera.
  // L'ordine del risultato coincide con quello dell'input.
  const GAP = 0.04;
  const order = bars.map((b, i) => ({ b, i, r0: Math.max(0, Math.floor(b.row ?? 0)) }))
    .sort((x, y) => x.r0 - y.r0 || (y.b.end_m - y.b.start_m) - (x.b.end_m - x.b.start_m) || x.b.start_m - y.b.start_m);
  const occ: { s: number; e: number }[][] = [];
  const res: PBar[] = new Array(bars.length);
  for (const { b, i, r0 } of order) {
    let r = r0;
    while ((occ[r] ?? []).some((o) => b.start_m < o.e + GAP && o.s < b.end_m + GAP)) r++;
    (occ[r] ??= []).push({ s: b.start_m, e: b.end_m });
    res[i] = { label: b.label, status: b.status, start: b.start_m, end: b.end_m, row: r, out: 'in' };
  }
  // compatta le righe vuote
  const used = [...new Set(res.map((x) => x.row))].sort((a, c) => a - c);
  const map = new Map(used.map((r, k) => [r, k]));
  res.forEach((x) => { x.row = map.get(x.row) ?? 0; });
  return { bars: res, rows: Math.max(1, used.length) };
}
export const PIPE = { top: 145, bottom: 676, laneGap: 8, minPitch: 12, maxPitch: 20 };
export const pipePitch = (rows: number, lanes: number) =>
  Math.max(11, Math.min(PIPE.maxPitch, (PIPE.bottom - PIPE.top - lanes * PIPE.laneGap) / Math.max(1, rows)));

const SEV: Status[] = ['blocked', 'delay', 'onhold', 'ontrack'];

export function buildSlides(st: AppState, includeArchive = false): Slide[] {
  const active = (a: Item['area']) => st.items.filter((i) => i.area === a && !i.archived_at).sort((x, y) => x.position - y.position);
  const slides: Slide[] = [{ kind: 'cover' }, { kind: 'section', title: st.deck.subtitle || 'Status Update' }];

  const cellsOf = (theme: 'mc' | 'sc', it: Item, n: string) => {
    const act = it.activity || sLabel(it.status);
    return theme === 'mc'
      ? [n, it.type, it.description, it.priority, it.requested_date, it.golive_date, it.release_date, it.owner, fmtEstimate(it.estimate), it.contract, act]
      : [n, it.description, it.priority, it.requested_date, it.golive_date, it.release_date, it.owner, fmtEstimate(it.estimate), it.contract, act];
  };
  const tableSlides = (theme: 'mc' | 'sc', title: string, items: Item[]) => {
    const cols = COLS[theme];
    const { pages, tier } = paginateSmart(items, (it, t) => estRowH(cols, cellsOf(theme, it, '00'), t));
    let n0 = 0;
    pages.forEach((page, p) => {
      const rows: SRow[] = page.map((it, k) => ({ cells: cellsOf(theme, it, String(n0 + k + 1)), status: it.status }));
      n0 += page.length;
      slides.push({
        kind: 'table', theme, title, part: pages.length > 1 ? `${p + 1}/${pages.length}` : '', columns: cols, rows,
        statusCol: cols.length - 1, prioCol: cols.findIndex((c) => c.name === 'Priorità'), legend: true, tier,
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
      const worst = SEV.find((s) => page.some((i) => i.status === s)) ?? (page.every((i) => i.status === 'completed') ? 'completed' : 'ontrack');
      const contract = page.find((i) => i.contract)?.contract ?? '';
      slides.push({
        kind: 'table', theme: 'ams', title: 'Action points & Next Steps – CRM & Service Cloud', part: pages.length > 1 ? `AMS ${p + 1}/${pages.length}` : 'AMS',
        columns: COLS.amsblock, statusCol: 4, prioCol: -1, legend: true,
        rows: [{
          status: worst,
          cells: [String(scItems.length + 1), 'Ticket AMS', '', contract, sLabel(worst)],
          ams: page.map((i) => ({ t: `${i.code ? i.code + ' - ' : ''}${i.description}`, tag: (i.ams_status ? AMS_STATUS[i.ams_status].label : i.activity || sLabel(i.status)) + (i.golive_date ? ` – GoLive ${i.golive_date}` : '') })),
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
      const { pages, tier } = paginateSmart(arch, (it, t) => estRowH(COLS.completed, cc(it), t));
      pages.forEach((page, p, all) => {
        slides.push({
          kind: 'table', theme: 'completed', title: 'Completed Activities', part: all.length > 1 ? `${p + 1}/${all.length}` : '',
          columns: COLS.completed, statusCol: 7, prioCol: 2, legend: false, tier,
          rows: page.map((it) => ({ completed: true, status: 'completed' as Status, cells: cc(it) })),
        });
      });
    }
  }
  slides.push({ kind: 'closing' });
  return slides;
}
