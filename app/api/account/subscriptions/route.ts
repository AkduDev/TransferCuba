import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { DbUnavailableError } from '@/lib/db-auth';
import { listSubscriptionsOfUser } from '@/lib/db-plans';
import { toSubscriptionDTO } from '@/lib/plans-dto';

export const dynamic = 'force-dynamic';

// GET /api/account/subscriptions — los planes de quien pregunta.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: 'Inicia sesión primero' }, { status: auth.status });
  }
  try {
    const filas = await listSubscriptionsOfUser(auth.user.id);
    return NextResponse.json(
      { success: true, subscriptions: filas.map(toSubscriptionDTO) },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    if (error instanceof DbUnavailableError) {
      return NextResponse.json(
        { success: false, error: 'Servicio temporalmente no disponible' },
        { status: 503 }
      );
    }
    console.error('[api] GET /api/account/subscriptions:', (error as Error)?.message ?? error);
    return NextResponse.json({ success: false, error: 'No se pudo cargar' }, { status: 400 });
  }
}
