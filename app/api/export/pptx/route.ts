import { isErr, needUser } from '@/lib/http';
import { buildPptx } from '@/lib/pptx';
import { getState } from '@/lib/state';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: Request) {
  const me = await needUser();
  if (isErr(me)) return me;
  const archive = new URL(req.url).searchParams.get('archive') === '1';
  const st = await getState();
  const buf = await buildPptx(st, archive);
  return new Response(new Uint8Array(buf), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'content-disposition': `attachment; filename="GG_Weekly_SAL_${st.deck.week_label.replace(/\W+/g, '_')}.pptx"`,
    },
  });
}
