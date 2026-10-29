import { q } from '@/lib/db';
import { audit, fail, isErr, json, needUser } from '@/lib/http';
import { currentDeck } from '@/lib/state';

const FIELDS = ['week_label', 'client', 'subtitle', 'date_label', 'logo_left_url', 'logo_right_url', 'bg_cover_url', 'bg_divider_url', 'bg_table_url'] as const;

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
    if (['week_label', 'client', 'subtitle', 'date_label'].includes(k) && !v) continue;
    vals.push(v); sets.push(`${k} = $${vals.length}`);
  }
  if (Number.isFinite(+b.overlay)) { vals.push(Math.max(0, Math.min(90, Math.round(+b.overlay)))); sets.push(`overlay = $${vals.length}`); }
  if (Number.isFinite(+b.year) && +b.year > 2000) { vals.push(Math.round(+b.year)); sets.push(`year = $${vals.length}`); }
  if (!sets.length) return fail('Nessuna modifica');
  vals.push(deck.id);
  await q(`update decks set ${sets.join(', ')} where id = $${vals.length}`, vals);
  await audit(me, 'update', 'deck', deck.id);
  return json({ ok: true });
}
