import { q } from '@/lib/db';
import { audit, fail, isErr, json, needAdmin } from '@/lib/http';
import { DATE_FIELDS, diffItems, type DateField, type NormOpts } from '@/lib/normalize';
import { currentDeck } from '@/lib/state';

export const runtime = 'nodejs';

function readOpts(b: any): { opts: NormOpts; fields: DateField[] } {
  const rules = Array.isArray(b?.rules) ? b.rules.slice(0, 50).map((r: any) => ({ from: String(r?.from ?? '').slice(0, 60), to: String(r?.to ?? '').slice(0, 60) })) : [];
  const fields = (Array.isArray(b?.fields) ? b.fields : [...DATE_FIELDS]).filter((f: any) => (DATE_FIELDS as readonly string[]).includes(f)) as DateField[];
  return { opts: { months: b?.months !== false, prefixes: b?.prefixes !== false, rules }, fields };
}

// POST { rules, months, prefixes, fields, dryRun } - SOLO settimana corrente (voci attive e archiviate del deck corrente)
export async function POST(req: Request) {
  const me = await needAdmin();
  if (isErr(me)) return me;
  const b = await req.json().catch(() => ({}));
  const { opts, fields } = readOpts(b);
  if (!fields.length) return fail('Seleziona almeno un campo');
  const deck = await currentDeck();
  const items = await q<any>('select id, code, area, requested_date, golive_date, release_date from items where deck_id = $1', [deck.id]);
  const changes = diffItems(items, fields, opts);
  if (b.dryRun) return json({ ok: true, week: deck.week_label, analyzed: items.length, total: changes.length, changes: changes.slice(0, 300) });
  if (!changes.length) return json({ ok: true, applied: 0 });
  for (const f of fields) {
    const rows = changes.filter((c) => c.field === f).map((c) => ({ id: c.id, after: c.after }));
    if (!rows.length) continue;
    // il nome colonna arriva dalla whitelist DATE_FIELDS
    await q(`update items t set ${f} = x.after, updated_by = $2, updated_at = now() from jsonb_to_recordset($1::jsonb) as x(id uuid, after text) where t.id = x.id`, [JSON.stringify(rows), me.username]);
  }
  await audit(me, 'normalize', 'items', deck.id, { week: deck.week_label, changes });
  return json({ ok: true, applied: changes.length });
}

// GET -> ultima normalizzazione annullabile
export async function GET() {
  const me = await needAdmin();
  if (isErr(me)) return me;
  const last = await q<any>("select id, at, user_name, jsonb_array_length(detail->'changes') as n from audit_log where action = 'normalize' order by at desc limit 1");
  if (!last[0]) return json({ ok: true, last: null });
  const undone = await q<any>("select 1 from audit_log where action = 'normalize_undo' and detail->>'of' = $1 limit 1", [String(last[0].id)]);
  return json({ ok: true, last: { id: String(last[0].id), at: last[0].at, by: last[0].user_name, n: Number(last[0].n), undone: undone.length > 0 } });
}

// DELETE -> annulla l'ultima normalizzazione (ripristina solo le voci che hanno ancora il valore normalizzato)
export async function DELETE() {
  const me = await needAdmin();
  if (isErr(me)) return me;
  const last = await q<any>("select id, detail from audit_log where action = 'normalize' order by at desc limit 1");
  if (!last[0]) return fail('Nessuna normalizzazione da annullare', 404);
  const done = await q<any>("select 1 from audit_log where action = 'normalize_undo' and detail->>'of' = $1 limit 1", [String(last[0].id)]);
  if (done.length) return fail('Ultima normalizzazione gia annullata', 409);
  const changes: any[] = last[0].detail?.changes ?? [];
  let restored = 0;
  for (const f of DATE_FIELDS) {
    const rows = changes.filter((c) => c.field === f).map((c) => ({ id: c.id, before: c.before, after: c.after }));
    if (!rows.length) continue;
    const r = await q<any>(
      `update items t set ${f} = x.before, updated_by = $2, updated_at = now()
         from jsonb_to_recordset($1::jsonb) as x(id uuid, before text, after text) where t.id = x.id and t.${f} = x.after returning t.id`,
      [JSON.stringify(rows), me.username]);
    restored += r.length;
  }
  await audit(me, 'normalize_undo', 'items', null, { of: String(last[0].id), restored });
  return json({ ok: true, restored });
}
