import { getState } from '@/lib/state';
import { isErr, json, needUser } from '@/lib/http';
export const dynamic = 'force-dynamic';
export async function GET() {
  const me = await needUser();
  if (isErr(me)) return me;
  return json({ me, state: await getState() });
}
