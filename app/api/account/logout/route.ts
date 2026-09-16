import { NextRequest, NextResponse } from 'next/server';
import { revokeSession } from '@/lib/db-auth';
import { clearAuthCookie, getSessionId } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// POST /api/account/logout — revoca la sesión en la BD y borra la cookie.
// Best-effort: aunque la BD falle, la cookie se limpia igualmente.
export async function POST(req: NextRequest) {
  const sessionId = getSessionId(req);
  if (sessionId) {
    try {
      await revokeSession(sessionId);
    } catch {
      // best-effort: la cookie se borra de todos modos
    }
  }

  const cookie = clearAuthCookie();
  const res = NextResponse.json({ success: true });
  res.cookies.set(cookie.name, cookie.value, cookie.options);
  return res;
}
