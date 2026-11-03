// Normalizzazione delle label data libere (Requested / GoLive / Release): "Beg Sept" -> "Beg Sep", "End June" -> "End Jun".
export const DATE_FIELDS = ['requested_date', 'golive_date', 'release_date'] as const;
export type DateField = (typeof DATE_FIELDS)[number];
export type Rule = { from: string; to: string };
export type NormOpts = { months: boolean; prefixes: boolean; rules: Rule[] };

const M3: Record<string, string> = { jan: 'Jan', feb: 'Feb', mar: 'Mar', apr: 'Apr', may: 'May', jun: 'Jun', jul: 'Jul', aug: 'Aug', sep: 'Sep', oct: 'Oct', nov: 'Nov', dec: 'Dec' };
const MONTH_RE = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b\.?/gi;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function normalizeLabel(v: string, o: NormOpts): string {
  let s = String(v ?? '');
  if (!s.trim()) return s;
  for (const r of o.rules) {
    const from = String(r.from ?? '').trim();
    if (!from) continue;
    s = s.replace(new RegExp(`(?<![A-Za-z0-9])${esc(from)}(?![A-Za-z0-9])`, 'gi'), String(r.to ?? '').trim());
  }
  if (o.prefixes) s = s.replace(/\b(beginning|begin|beg)\b\.?/gi, 'Beg').replace(/\b(middle|mid)\b\.?/gi, 'Mid');
  if (o.months) s = s.replace(MONTH_RE, (_m, g: string) => M3[g.slice(0, 3).toLowerCase()]);
  return s.replace(/\s+/g, ' ').trim();
}

export type Change = { id: string; code: string; area: string; field: DateField; before: string; after: string };

export function diffItems(items: { id: string; code: string; area: string; requested_date: string; golive_date: string; release_date: string }[], fields: DateField[], o: NormOpts): Change[] {
  const out: Change[] = [];
  for (const it of items)
    for (const f of fields) {
      const before = it[f] ?? '';
      const after = normalizeLabel(before, o);
      if (after !== before) out.push({ id: it.id, code: it.code, area: it.area, field: f, before, after });
    }
  return out;
}
