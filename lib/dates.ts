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
