import { NextRequest, NextResponse } from 'next/server';
import { sessionValidFromRequest } from '@/lib/admin-auth';
import { DbUnavailableError } from '@/lib/db-auth';
import { listPendingPlanPayments } from '@/lib/db-plans';
import { toPlanPaymentDTO } from '@/lib/plans-dto';

export const dynamic = 'force-dynamic';

// GET /api/admin/plan-payments — cola de pagos por confirmar, el más antiguo primero.
export async function GET(req: NextRequest) {
  if (!sessionValidFromRequest(req)) {
    return NextResponse.json({ success: false, error: 'Acceso de administrador requerido' }, { status: 401 });
  }
  try {
    const filas = await listPendingPlanPayments();
    return NextResponse.json(
      {
        success: true,
        payments: filas.map((f) => toPlanPaymentDTO(f, { includePayer: true, includePlan: true }))
      },
      // Lleva el teléfono de quien paga: jamás en una caché compartida.
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    if (error instanceof DbUnavailableError) {
      return NextResponse.json({ success: false, error: 'Servicio temporalmente no disponible' }, { status: 503 });
    }
    console.error('[api] GET /api/admin/plan-payments:', (error as Error)?.message ?? error);
    return NextResponse.json({ success: false, error: 'No se pudieron cargar los pagos' }, { status: 400 });
  }
}
