import { NextRequest, NextResponse } from 'next/server';
import { isAdminConfigured, validateAdminCredentials, adminCookie } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

// POST /api/auth/login — valida credenciales contra el entorno y emite la
// sesión firmada en cookie HttpOnly. Sin credenciales en el bundle del cliente.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const username = typeof body?.username === 'string' ? body.username : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!isAdminConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Auth no configurada (ADMIN_PASSWORD en .env)' },
        { status: 503 }
      );
    }

    if (!username || !password || !validateAdminCredentials(username, password)) {
      return NextResponse.json(
        { success: false, error: 'Usuario o contraseña incorrectos.' },
        { status: 401 }
      );
    }

    const cookie = adminCookie();
    const res = NextResponse.json({ success: true });
    res.cookies.set(cookie.name, cookie.value, cookie.options);
    return res;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
  }
}