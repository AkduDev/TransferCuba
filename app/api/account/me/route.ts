import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/account/me — estado de la sesión de usuario desde la cookie HttpOnly.
// Nunca 401: el frontend lo usa para hidratar el estado de sesión.
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  return NextResponse.json({ authenticated: user !== null, user });
}
