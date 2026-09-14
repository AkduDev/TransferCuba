import { NextRequest, NextResponse } from 'next/server';
import { sessionValidFromRequest } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

// GET /api/auth/me — estado de la sesión admin desde la cookie (HttpOnly).
// El frontend pregunta aquí en vez de confiar en localStorage.
export async function GET(req: NextRequest) {
  return NextResponse.json({ authenticated: sessionValidFromRequest(req) });
}