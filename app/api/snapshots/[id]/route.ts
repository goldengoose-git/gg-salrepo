import { q } from '@/lib/db';
import { fail, isErr, needUser } from '@/lib/http';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await needUser();
  if (isErr(me)) return me;
  const { id } = await params;
  const r = await q<any>('select week_label, payload from snapshots where id=$1', [id]);
  if (!r[0]) return fail('Non trovato', 404);
  return new Response(JSON.stringify({ format: 'sal-builder', version: 1, snapshot: true, ...r[0].payload }, null, 2), {
    headers: { 'content-type': 'application/json', 'content-disposition': `attachment; filename="SAL_${r[0].week_label.replace(/\W+/g, '_')}_snapshot.json"` },
  });
}
