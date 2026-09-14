import { NextResponse } from 'next/server';
import { clearAdminCookie } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

// POST /api/auth/logout — invalida la sesión del cliente (cookie HttpOnly).
export async function POST() {
  const cookie = clearAdminCookie();
  const res = NextResponse.json({ success: true });
  res.cookies.set(cookie.name, cookie.value, cookie.options);
  return res;
}