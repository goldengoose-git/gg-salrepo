import { q } from '@/lib/db';
import { audit, isErr, json, needUser } from '@/lib/http';
import { getState } from '@/lib/state';

export async function POST() {
  const me = await needUser();
  if (isErr(me)) return me;
  const st = await getState();
  const { snapshots, ...payload } = st;
  await q('insert into snapshots (deck_id, week_label, payload, created_by) values ($1,$2,$3,$4)', [st.deck.id, st.deck.week_label, JSON.stringify(payload), me.username]);
  await q(`update decks set status='published', published_at=now() where id=$1`, [st.deck.id]);
  await audit(me, 'publish', 'deck', st.deck.id);
  return json({ ok: true });
}
