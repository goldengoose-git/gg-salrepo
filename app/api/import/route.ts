import { applyImport, parseAny } from '@/lib/importer';
import { audit, fail, isErr, json, needUser } from '@/lib/http';
import { currentDeck } from '@/lib/state';
import { q } from '@/lib/db';

// POST { json, scope: 'all'|'mine'|'timeline', mode: 'merge'|'replace', dryRun?: boolean, applyMeta?: boolean }
export async function POST(req: Request) {
  const me = await needUser();
  if (isErr(me)) return me;
  const b = await req.json().catch(() => null);
  if (!b?.json) return fail('JSON mancante');
  let parsed;
  try {
    parsed = parseAny(typeof b.json === 'string' ? JSON.parse(b.json) : b.json);
  } catch (e: any) {
    return fail(e.message || 'JSON non valido');
  }
  const summary = {
    items: parsed.items.length,
    mc: parsed.items.filter((i) => i.area === 'MC').length,
    sc: parsed.items.filter((i) => i.area === 'SC').length,
    ams: parsed.items.filter((i) => i.area === 'AMS').length,
    archived: parsed.items.filter((i) => i.archived).length,
    bars: parsed.bars.length,
    role: me.role,
  };
  if (b.dryRun) return json({ ok: true, summary });
  const deck = await currentDeck();
  const scope = ['all', 'mine', 'timeline'].includes(b.scope) ? b.scope : 'all';
  const mode = b.mode === 'replace' ? 'replace' : 'merge';
  const res = await applyImport(parsed, { deckId: deck.id, role: me.role, scope, mode, user: me.username });
  if (b.applyMeta && parsed.deck) {
    const d = parsed.deck;
    await q(`update decks set client=coalesce($1,client), subtitle=coalesce($2,subtitle), date_label=coalesce($3,date_label), year=coalesce($4,year) where id=$5`,
      [d.client ?? null, d.subtitle ?? null, d.date_label ?? null, d.year ?? null, deck.id]);
  }
  await audit(me, 'import', 'deck', deck.id, { scope, mode, ...res });
  return json({ ok: true, summary, imported: res });
}
