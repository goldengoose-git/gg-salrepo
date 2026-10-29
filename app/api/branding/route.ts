import { q } from '@/lib/db';
import { audit, fail, isErr, json, needUser } from '@/lib/http';

export const dynamic = 'force-dynamic';

// pubblico: serve alla pagina di login
export async function GET() {
  try {
    const r = await q<{ value: string }>(`select value from settings where key = 'login_logo_url'`);
    return json({ login_logo_url: r[0]?.value || null });
  } catch {
    return json({ login_logo_url: null });
  }
}

export async function PATCH(req: Request) {
  const me = await needUser();
  if (isErr(me)) return me;
  const b = await req.json().catch(() => ({}));
  if (b.login_logo_url === undefined) return fail('Nessuna modifica');
  const v = b.login_logo_url ? String(b.login_logo_url).slice(0, 1000) : '';
  await q(`insert into settings (key, value) values ('login_logo_url', $1) on conflict (key) do update set value = excluded.value`, [v]);
  await audit(me, 'update', 'branding', null);
  return json({ ok: true });
}
