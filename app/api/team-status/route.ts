import { q } from '@/lib/db';
import { audit, isErr, json, needUser } from '@/lib/http';
import { currentDeck } from '@/lib/state';

// POST { done: boolean } -> il team dell'utente segna (o riapre) l'editing della settimana corrente
export async function POST(req: Request) {
  const me = await needUser();
  if (isErr(me)) return me;
  const b = await req.json().catch(() => ({}));
  const deck = await currentDeck();
  if (b.done === false) await q('delete from team_status where deck_id = $1 and team = $2', [deck.id, me.role]);
  else await q(
    `insert into team_status (deck_id, team, done_at, done_by) values ($1,$2,now(),$3)
     on conflict (deck_id, team) do update set done_at = now(), done_by = excluded.done_by`,
    [deck.id, me.role, me.name]
  );
  await audit(me, b.done === false ? 'reopen' : 'editing_done', 'deck', deck.id);
  return json({ ok: true });
}
