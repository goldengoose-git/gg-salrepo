const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const utc = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
export const isIso = (s: any): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(+utc(s));

// settimana ISO 8601 (lunedì-domenica) della data
export function isoWeek(iso: string): number {
  const d = utc(iso);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const y0 = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((+d - y0) / 86400000 + 1) / 7);
}
export const weekLabel = (iso: string) => `Week ${isoWeek(iso)}`;
// 2026-10-28 -> "28th October 2026"
export function formatSalDate(iso: string): string {
  const d = utc(iso), n = d.getUTCDate();
  const suf = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${suf} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
export function addDays(iso: string, n: number): string {
  const d = utc(iso); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
// "28th October 2026" / "28 October 2026" -> "2026-10-28" (solo per i deck già esistenti)
export function parseSalLabel(label: string): string | null {
  const m = String(label ?? '').match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})/);
  if (!m) return null;
  const mi = MONTHS.findIndex((x) => x.toLowerCase().startsWith(m[2].toLowerCase().slice(0, 3)));
  if (mi < 0) return null;
  return `${m[3]}-${String(mi + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

// ---- GoLive date -> data (per le finestre Completed 14/7 gg) ----
const MON_ABBR: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11, gen: 0, mag: 4, giu: 5, lug: 6, ago: 7, set: 8, ott: 9, dic: 11 };
/** "28/10", "4/12/2026", "28 Oct", "Beg|Mid|End Oct" (5 / 15 / 25 del mese) -> timestamp UTC; senza anno si sceglie l'anno piu vicino a `ref`. null se non e una data (TBD, vuoto, Q4...). */
export function parseGolive(txt: string, ref: Date): number | null {
  const t = String(txt ?? '').trim().toLowerCase();
  if (!t) return null;
  let d: number, mo: number, y: number | null = null, m: RegExpMatchArray | null;
  if ((m = t.match(/^(\d{1,2})\s*[\/.-]\s*(\d{1,2})(?:\s*[\/.-]\s*(\d{2,4}))?$/))) {
    d = +m[1]; mo = +m[2] - 1; if (m[3]) y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
  } else if ((m = t.match(/^(beg\w*|inizio|mid\w*|met[aà]|end\w*|fine)\.?\s+([a-z]{3,})/))) {
    d = /^(beg|ini)/.test(m[1]) ? 5 : /^(mid|met)/.test(m[1]) ? 15 : 25; mo = MON_ABBR[m[2].slice(0, 3)] ?? -1;
  } else if ((m = t.match(/^(\d{1,2})\s+([a-z]{3,})/))) {
    d = +m[1]; mo = MON_ABBR[m[2].slice(0, 3)] ?? -1;
  } else return null;
  if (!(mo >= 0 && mo <= 11 && d >= 1 && d <= 31)) return null;
  if (y !== null) return Date.UTC(y, mo, d);
  const r = +ref, y0 = ref.getUTCFullYear();
  return [y0 - 1, y0, y0 + 1].map((yy) => Date.UTC(yy, mo, d)).sort((a, b) => Math.abs(a - r) - Math.abs(b - r))[0];
}
/** Data di riferimento di una voce completata: GoLive date se e una data, altrimenti la chiusura. */
export function doneTime(it: { golive_date: string; closed_at?: string | null; archived_at?: string | null }, ref: Date): number {
  return parseGolive(it.golive_date, ref) ?? Date.parse(String(it.closed_at ?? it.archived_at ?? ''));
}
