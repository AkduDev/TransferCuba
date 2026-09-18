import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  listDeliveryHistory,
  DbUnavailableError,
  InvalidReviewError,
  type DeliveryStatus
} from '@/lib/db-delivery';
import { toDeliveryDTO } from '@/lib/delivery-dto';

export const dynamic = 'force-dynamic';

const STATUSES: DeliveryStatus[] = [
  'PENDING',
  'ACCEPTED',
  'PICKED_UP',
  'IN_TRANSIT',
  'DELIVERED',
  'CANCELLED',
  'EXPIRED'
];

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

// GET /api/deliveries/history — historial paginado y role-aware.
// La propiedad de las filas la decide el servidor a partir del rol de la
// sesión; el cliente solo elige página, tamaño y filtro de estado.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return err('Inicia sesión primero', auth.status);

  const params = req.nextUrl.searchParams;

  const rawLimit = params.get('limit');
  let limit = 30;
  if (rawLimit !== null) {
    limit = Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      return err('El tamaño de página debe ser un entero entre 1 y 50', 400);
    }
  }

  const rawStatus = params.get('status');
  if (rawStatus !== null && !STATUSES.includes(rawStatus as DeliveryStatus)) {
    return err('Estado inválido', 400);
  }

  const cursor = params.get('cursor');
  if (cursor !== null && cursor.length > 200) {
    return err('Cursor inválido', 400);
  }

  try {
    const page = await listDeliveryHistory(auth.user.id, auth.user.role, {
      limit,
      cursor,
      status: rawStatus as DeliveryStatus | null
    });

    // Un mensajero no ve la identidad del solicitante de una carrera que no
    // llegó a aceptar; en su historial solo hay carreras suyas, así que la
    // contraparte sí corresponde. El DTO mantiene la regla explícita.
    const esMensajero = auth.user.role === 'MESSENGER';
    return NextResponse.json({
      success: true,
      deliveries: page.rows.map((r) =>
        toDeliveryDTO(r, {
          includeLocations: true,
          includeRequester: !esMensajero || r.messenger_id === auth.user.id,
          includeMessenger: true
        })
      ),
      nextCursor: page.nextCursor
    });
  } catch (error) {
    if (error instanceof InvalidReviewError) return err(error.message, 400);
    if (error instanceof DbUnavailableError) {
      return err('Servicio temporalmente no disponible', 503);
    }
    console.error('[api] GET /api/deliveries/history:', (error as Error)?.message ?? error);
    return err('No se pudo cargar el historial', 400);
  }
}
