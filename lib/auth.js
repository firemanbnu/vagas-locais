import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const COOKIE = 'vl_session';
const key = () => new TextEncoder().encode(process.env.SESSION_SECRET || 'dev-secret-troque');

export async function createSession(data) {
  const token = await new SignJWT(data)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(key());
  const c = await cookies();
  c.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession() {
  const c = await cookies();
  c.delete(COOKIE);
}

export async function getSession() {
  const c = await cookies();
  const token = c.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return payload; // { uid, role, cid? }
  } catch {
    return null;
  }
}

export async function requireCompany() {
  const s = await getSession();
  if (!s || s.role !== 'COMPANY' || !s.cid) redirect('/entrar?next=/painel');
  return s;
}

export async function requireAdmin() {
  const s = await getSession();
  if (!s || s.role !== 'ADMIN') redirect('/entrar?next=/admin');
  return s;
}
