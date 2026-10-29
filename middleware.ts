import { jwtVerify } from 'jose';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC = ['/login', '/api/login'];
const PUBLIC_GET = ['/api/branding'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // protezione CSRF: le richieste che modificano dati devono arrivare dallo stesso sito
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.headers.get('origin');
    if (origin && new URL(origin).host !== req.headers.get('host'))
      return NextResponse.json({ error: 'Origine non consentita' }, { status: 403 });
  }
  if (PUBLIC.some((p) => pathname === p)) return NextResponse.next();
  if (req.method === 'GET' && PUBLIC_GET.includes(pathname)) return NextResponse.next();
  const t = req.cookies.get('sal_session')?.value;
  let ok = false;
  if (t && process.env.SESSION_SECRET) {
    try { await jwtVerify(t, new TextEncoder().encode(process.env.SESSION_SECRET)); ok = true; } catch {}
  }
  if (ok) return NextResponse.next();
  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico|webp)$).*)'] };
