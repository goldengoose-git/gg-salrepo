import { q } from '@/lib/db';
import { audit, fail, isErr, json, needUser } from '@/lib/http';
import { currentDeck } from '@/lib/state';
import { formatSalDate, isIso, weekLabel } from '@/lib/dates';

const FIELDS = ['client', 'subtitle', 'logo_left_url', 'logo_right_url', 'bg_cover_url', 'bg_divider_url', 'bg_table_url'] as const;

export async function PATCH(req: Request) {
  const me = await needUser();
  if (isErr(me)) return me;
  const b = await req.json().catch(() => ({}));
  const deck = await currentDeck();
  const sets: string[] = [];
  const vals: any[] = [];
  for (const k of FIELDS) {
    if (b[k] === undefined) continue;
    const v = b[k] === '' ? null : String(b[k]).slice(0, 1000);
    if (['client', 'subtitle'].includes(k) && !v) continue;
    vals.push(v); sets.push(`${k} = $${vals.length}`);
  }
  // la data del SAL determina Week, testo della data in cover e anno
  if (b.sal_date !== undefined) {
    if (!isIso(b.sal_date)) return fail('Data non valida');
    vals.push(b.sal_date); sets.push(`sal_date = $${vals.length}`);
    vals.push(weekLabel(b.sal_date)); sets.push(`week_label = $${vals.length}`);
    vals.push(formatSalDate(b.sal_date)); sets.push(`date_label = $${vals.length}`);
    vals.push(+b.sal_date.slice(0, 4)); sets.push(`year = $${vals.length}`);
  }
  if (Number.isFinite(+b.overlay)) { vals.push(Math.max(0, Math.min(90, Math.round(+b.overlay)))); sets.push(`overlay = $${vals.length}`); }
  if (Number.isFinite(+b.year) && +b.year > 2000) { vals.push(Math.round(+b.year)); sets.push(`year = $${vals.length}`); }
  if (!sets.length) return fail('Nessuna modifica');
  vals.push(deck.id);
  await q(`update decks set ${sets.join(', ')} where id = $${vals.length}`, vals);
  await audit(me, 'update', 'deck', deck.id);
  return json({ ok: true });
}
