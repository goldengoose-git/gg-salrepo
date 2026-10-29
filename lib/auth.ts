import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import type { Me } from './types';

const COOKIE = 'sal_session';
const key = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error('SESSION_SECRET mancante o troppo corto');
  return new TextEncoder().encode(s);
};

export async function createSession(me: Me) {
  const token = await new SignJWT({ ...me })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('14d')
    .sign(key());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 14,
  });
}
export async function destroySession() {
  (await cookies()).delete(COOKIE);
}
export async function getSession(): Promise<Me | null> {
  const t = (await cookies()).get(COOKIE)?.value;
  if (!t) return null;
  try {
    const { payload } = await jwtVerify(t, key());
    return { username: String(payload.username), role: payload.role as Me['role'], name: String(payload.name) };
  } catch {
    return null;
  }
}
export const COOKIE_NAME = COOKIE;
