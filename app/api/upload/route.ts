import { put } from '@vercel/blob';
import { audit, fail, isErr, json, needUser } from '@/lib/http';

const OK = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
export const maxDuration = 30;
export async function POST(req: Request) {
  const me = await needUser();
  if (isErr(me)) return me;
  if (!process.env.BLOB_READ_WRITE_TOKEN) return fail('Vercel Blob non configurato (BLOB_READ_WRITE_TOKEN)', 500);
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return fail('File mancante');
  if (!OK.includes(file.type)) return fail('Formato non supportato (PNG, JPG, SVG, WEBP)');
  if (file.size > 4 * 1024 * 1024) return fail('File troppo grande (max 4 MB)');
  const safe = file.name.replace(/[^\w.\-]+/g, '_');
  try {
    const blob = await put(`sal/${Date.now()}-${safe}`, file, { access: 'public', addRandomSuffix: true, token: process.env.BLOB_READ_WRITE_TOKEN });
    await audit(me, 'upload', 'file', blob.url);
    return json({ url: blob.url });
  } catch (e: any) {
    return fail('Upload Blob fallito: ' + (e?.message || 'errore sconosciuto') + ' (lo store Blob deve essere Public)', 500);
  }
}
