import { q } from '@/lib/db';
import { audit, isErr, json, needAdmin } from '@/lib/http';
import { sanitizeColors } from '@/lib/ui-colors';

// PUT { colors } - colori dell'interfaccia interna. {} = ripristina i predefiniti. Non tocca slide, PPTX e PDF.
export async function PUT(req: Request) {
  const me = await needAdmin();
  if (isErr(me)) return me;
  const b = await req.json().catch(() => ({}));
  const colors = sanitizeColors(b?.colors);
  await q("insert into settings (key, value) values ('ui_colors', $1) on conflict (key) do update set value = excluded.value", [JSON.stringify(colors)]);
  await audit(me, 'colors', 'settings', 'ui_colors', colors);
  return json({ ok: true, colors });
}
