import { NextResponse } from 'next/server';

export async function GET(req) {
  const res = NextResponse.redirect(new URL('/', req.url));
  res.cookies.delete('vl_session');
  return res;
}
