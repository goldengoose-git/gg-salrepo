import { q } from '@/lib/db';
import { audit, fail, isErr, json, needUser } from '@/lib/http';
import { canManage } from '@/lib/lookups-server';
import { joinOwners, parseOwners } from '@/lib/lookups';
import { currentDeck } from '@/lib/state';

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await needUser();
  if (isErr(me)) return me;
  const { id } = await params;
  const r = await q<{ kind: string; value: string }>('select kind, value from lookups where id = $1', [id]);
  if (!r[0]) return fail('Non trovato', 404);
  if (!canManage(me.role, r[0].kind)) return fail('Non puoi modificare questo elenco', 403);
  await q('delete from lookups where id = $1', [id]);
  await audit(me, 'delete', 'lookup', id, r[0]);
  return json({ ok: true });
}

// Bonifica: rinomina un valore e aggiorna le voci della settimana corrente che lo usano.
// Se il nuovo nome esiste già nell'elenco, i due valori vengono uniti.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await needUser();
  if (isErr(me)) return me;
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const nv = String(b.value ?? '').trim().slice(0, 80);
  if (!nv) return fail('Inserisci un valore');
  const r = await q<{ kind: string; value: string }>('select kind, value from lookups where id = $1', [id]);
  if (!r[0]) return fail('Non trovato', 404);
  const { kind, value: old } = r[0];
  if (!canManage(me.role, kind)) return fail('Non puoi modificare questo elenco', 403);
  if (nv === old) return json({ ok: true, updated: 0 });

  const deck = await currentDeck();
  let updated = 0;
  if (kind === 'owner') {
    const rows = await q<{ id: string; owner: string }>(`select id, owner from items where deck_id = $1 and area <> 'AMS' and owner <> ''`, [deck.id]);
    for (const it of rows) {
      const list = parseOwners(it.owner);
      if (!list.includes(old)) continue;
      const next = joinOwners([...new Set(list.map((o) => (o === old ? nv : o)))]);
      await q('update items set owner = $1, updated_by = $2, updated_at = now() where id = $3', [next, me.username, it.id]);
      updated++;
    }
  } else {
    const area = kind === 'type_mc' ? 'MC' : 'SC';
    const res = await q<{ id: string }>(
      `update items set type = $1, updated_by = $2, updated_at = now() where deck_id = $3 and area = $4 and type = $5 returning id`,
      [nv, me.username, deck.id, area, old]
    );
    updated = res.length;
  }
  const exists = await q<{ id: string }>('select id from lookups where kind = $1 and value = $2', [kind, nv]);
  if (exists[0]) await q('delete from lookups where id = $1', [id]); // unione con il valore esistente
  else await q('update lookups set value = $1 where id = $2', [nv, id]);
  await audit(me, 'rename', 'lookup', id, { kind, from: old, to: nv, updated });
  return json({ ok: true, updated, merged: !!exists[0] });
}
