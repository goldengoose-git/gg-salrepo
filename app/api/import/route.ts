import { applyImport, parseAny } from '@/lib/importer';
import { csvToItems, isJira, parseCsv } from '@/lib/csv';
import { areasFor } from '@/lib/constants';
import { audit, fail, isErr, json, needUser } from '@/lib/http';
import { currentDeck } from '@/lib/state';
import { q } from '@/lib/db';
import { parseSalLabel, weekLabel } from '@/lib/dates';

// POST { json, scope: 'all'|'mine'|'timeline', mode: 'merge'|'replace', dryRun?: boolean, applyMeta?: boolean }
export async function POST(req: Request) {
  const me = await needUser();
  if (isErr(me)) return me;
  const b = await req.json().catch(() => null);
  if (!b?.json) return fail('JSON mancante');
  let parsed;
  try {
    const raw = typeof b.json === 'string' ? b.json.replace(/^\uFEFF/, '').trim() : b.json;
    if (typeof raw === 'string' && !/^[{\[]/.test(raw)) {
      // CSV: una riga di intestazione + righe di dati (stesse colonne dell'export CSV)
      parsed = { deck: {}, items: csvToItems(raw, areasFor(me.role)[0]), bars: [] };
    } else parsed = parseAny(typeof raw === 'string' ? JSON.parse(raw) : raw);
  } catch (e: any) {
    return fail(e.message || 'JSON non valido');
  }
  const jira = typeof b.json === 'string' && !/^[{\[]/.test(b.json.replace(/^\uFEFF/, '').trim()) && (() => { try { return isJira(parseCsv(b.json)[0] ?? []); } catch { return false; } })();
  let existingAms = 0, newDone = 0;
  if (jira) {
    const ex = await q<{ code: string }>("select code from items where deck_id = $1 and area = 'AMS' and code <> ''", [(await currentDeck()).id]);
    const have = new Set(ex.map((e) => e.code));
    const am = parsed.items.filter((i) => i.area === 'AMS');
    existingAms = am.filter((i) => i.code && have.has(i.code)).length;
    newDone = am.filter((i) => !(i.code && have.has(i.code)) && i.ams_status === 'done').length;
  }
  const byAms: Record<string, number> = {};
  for (const i of parsed.items) if (i.area === 'AMS') byAms[i.ams_status ?? 'wip'] = (byAms[i.ams_status ?? 'wip'] ?? 0) + 1;
  const summary = {
    jira, existingAms, newDone, byAms,
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
  const res = await applyImport(parsed, { deckId: deck.id, role: me.role, scope, mode, user: me.username, skipNewDone: b.includeDone === false });
  if (b.applyMeta && parsed.deck) {
    const d = parsed.deck;
    await q(`update decks set client=coalesce($1,client), subtitle=coalesce($2,subtitle), date_label=coalesce($3,date_label), year=coalesce($4,year) where id=$5`,
      [d.client ?? null, d.subtitle ?? null, d.date_label ?? null, d.year ?? null, deck.id]);
    // se la data del file è riconoscibile, aggiorna anche data SAL e Week (restano coerenti)
    const iso = d.date_label ? parseSalLabel(d.date_label) : null;
    if (iso) await q('update decks set sal_date=$1, week_label=$2, year=$3 where id=$4', [iso, weekLabel(iso), +iso.slice(0, 4), deck.id]);
  }
  await audit(me, 'import', 'deck', deck.id, { scope, mode, ...res });
  return json({ ok: true, summary, imported: res });
}
