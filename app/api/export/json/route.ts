import { isErr, needUser } from '@/lib/http';
import { getState } from '@/lib/state';

export async function GET() {
  const me = await needUser();
  if (isErr(me)) return me;
  const { snapshots, ...st } = await getState();
  const body = { format: 'sal-builder', version: 1, exported_at: new Date().toISOString(), ...st };
  return new Response(JSON.stringify(body, null, 2), {
    headers: { 'content-type': 'application/json', 'content-disposition': `attachment; filename="SAL_${st.deck.week_label.replace(/\W+/g, '_')}.json"` },
  });
}
