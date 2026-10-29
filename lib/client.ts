export async function api<T = any>(path: string, method = 'GET', body?: any): Promise<T> {
  const r = await fetch(path, {
    method, headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Errore ${r.status}`);
  return j as T;
}
export async function download(path: string, fallback: string) {
  const r = await fetch(path);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `Errore ${r.status}`);
  const cd = r.headers.get('content-disposition') || '';
  const name = /filename="([^"]+)"/.exec(cd)?.[1] || fallback;
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
// carica un'immagine e restituisce l'URL; errori sempre leggibili
export async function uploadImage(file: File): Promise<string> {
  if (file.size > 4 * 1024 * 1024) throw new Error('File troppo grande (max 4 MB)');
  const fd = new FormData(); fd.append('file', file);
  const r = await fetch('/api/upload', { method: 'POST', body: fd });
  const txt = await r.text();
  let j: any = {};
  try { j = JSON.parse(txt); } catch {}
  if (!r.ok || !j.url) throw new Error(j.error || (r.status === 413 ? 'File troppo grande' : `Upload fallito (${r.status}). Controlla il token Blob su Vercel e fai Redeploy`));
  return j.url;
}
