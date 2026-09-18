import { NextRequest, NextResponse } from 'next/server';
import { sessionValidFromRequest } from '@/lib/admin-auth';
import { listMessengerApplications, DbUnavailableError } from '@/lib/db-delivery';

export const dynamic = 'force-dynamic';

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function GET(req: NextRequest) {
  if (!sessionValidFromRequest(req)) {
    return err('Acceso de administrador requerido', 401);
  }

  try {
    const status = req.nextUrl.searchParams.get('status');
    const applications = await listMessengerApplications(
      status === 'PENDING' || status === 'ACTIVE' || status === 'SUSPENDED'
        ? status
        : undefined
    );
    return NextResponse.json({ success: true, applications });
  } catch (error) {
    if (error instanceof DbUnavailableError) {
      return err('Servicio temporalmente no disponible', 503);
    }
    console.error('[api] GET /api/admin/messengers:', (error as Error)?.message ?? error);
    return err('No se pudieron listar las solicitudes', 400);
  }
}
