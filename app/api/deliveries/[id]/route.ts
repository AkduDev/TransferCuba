import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  transitionDelivery,
  getDeliveryRequest,
  getMessengerProfile,
  trustDelivery,
  DbUnavailableError,
  InvalidTransitionError,
  type DeliveryRequestRow,
  type DeliveryStatus
} from '@/lib/db-delivery';
import { toDeliveryDTO } from '@/lib/delivery-dto';
import type { PublicUser } from '@/lib/db-auth';

export const dynamic = 'force-dynamic';

function err(msg: string, status: number) {
  return NextResponse.json({ success: false, error: msg }, { status });
}

// GET /api/deliveries/[id] — vista de una carrera con filtrado por rol.
//  - solicitante / admin: detalle completo.
//  - mensajero asignado: direcciones + identidad de la contraparte.
//  - cualquier otra persona: 403 (las PENDING viven en /available, sin datos).
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return err('Inicia sesión primero', auth.status);

  const { id } = await ctx.params;
  let row;
  try {
    row = await getDeliveryRequest(id);
  } catch (e) {
    if (e instanceof DbUnavailableError) return err('Servicio temporalmente no disponible', 503);
    throw e;
  }
  if (!row) return err('Carrera no encontrada', 404);

  const isRequester = row.requester_id === auth.user.id;
  const isAssignedMessenger = row.messenger_id === auth.user.id;
  const isAdmin = auth.user.role === 'ADMIN';

  if (isAdmin || isRequester || (isAssignedMessenger && row.status !== 'PENDING')) {
    return deliveryOK(row);
  }
  return err('No tienes acceso a esta carrera', 403);
}

// PATCH /api/deliveries/[id] — acciones del ciclo de una carrera.
//   accept    mensajero   PENDING   → ACCEPTED  (doble aceptación imposible)
//   pick_up   mensajero   ACCEPTED  → PICKED_UP
//   in_transit  mensajero PICKED_UP → IN_TRANSIT
//   deliver   mensajero   IN_TRANSIT→ DELIVERED
//   cancel    solicitante PENDING   → CANCELLED  (o ADMIN en estados activos)
//   trust     solicitante DELIVERED → marca confianza en el mensajero
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return err('Inicia sesión primero', auth.status);

  const { id } = await ctx.params;

  let body: { action?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return err('JSON inválido', 400);
  }

  try {
    switch (body.action) {
      case 'accept':
        return await handleAccept(id, auth.user, body.note);
      case 'pick_up':
        return await handleMessengerStep(id, auth.user, 'ACCEPTED', 'PICKED_UP');
      case 'in_transit':
        return await handleMessengerStep(id, auth.user, 'PICKED_UP', 'IN_TRANSIT');
      case 'deliver':
        return await handleMessengerStep(id, auth.user, 'IN_TRANSIT', 'DELIVERED');
      case 'cancel':
        return await handleCancel(id, auth.user, body.note);
      case 'trust':
        return await handleTrust(id, auth.user);
      default:
        return err('Acción no válida', 400);
    }
  } catch (e) {
    if (e instanceof InvalidTransitionError) return err(e.message, 409);
    if (e instanceof DbUnavailableError) return err('Servicio temporalmente no disponible', 503);
    console.error('[api] PATCH /api/deliveries/[id]:', (e as Error)?.message ?? e);
    return err('No se pudo procesar la acción', 400);
  }
}

function deliveryOK(row: DeliveryRequestRow) {
  return NextResponse.json({
    success: true,
    delivery: toDeliveryDTO(row, { includeLocations: true, includeRequester: true, includeMessenger: true })
  });
}

async function handleAccept(id: string, user: PublicUser, note: unknown) {
  if (user.role !== 'MESSENGER') return err('Solo para mensajeros', 403);
  const profile = await getMessengerProfile(user.id);
  if (!profile || profile.status !== 'ACTIVE') {
    return err('Tu perfil de mensajero está pendiente o suspendido', 403);
  }
  const row = await transitionDelivery({
    id,
    fromStatuses: ['PENDING'],
    toStatus: 'ACCEPTED',
    actorId: user.id,
    actorRole: user.role,
    note: typeof note === 'string' && note.trim() ? note.trim() : null
  });
  return deliveryOK(row);
}

async function handleMessengerStep(
  id: string,
  user: PublicUser,
  fromStatus: DeliveryStatus,
  toStatus: DeliveryStatus
) {
  if (user.role !== 'MESSENGER') return err('Solo para mensajeros', 403);
  const current = await getDeliveryRequest(id);
  if (!current) return err('Carrera no encontrada', 404);
  if (current.messenger_id !== user.id) return err('No tienes esta carrera asignada', 403);
  const row = await transitionDelivery({
    id,
    fromStatuses: [fromStatus],
    toStatus,
    actorId: user.id,
    actorRole: user.role
  });
  return deliveryOK(row);
}

async function handleCancel(id: string, user: PublicUser, note: unknown) {
  const current = await getDeliveryRequest(id);
  if (!current) return err('Carrera no encontrada', 404);
  const isRequester = current.requester_id === user.id;
  const isAdmin = user.role === 'ADMIN';
  if (!isRequester && !isAdmin) return err('No tienes esta carrera', 403);

  const fromStatuses: DeliveryStatus[] = isAdmin
    ? ['PENDING', 'ACCEPTED', 'PICKED_UP', 'IN_TRANSIT']
    : ['PENDING'];
  const cancelReason = typeof note === 'string' && note.trim() ? note.trim() : null;

  const row = await transitionDelivery({
    id,
    fromStatuses,
    toStatus: 'CANCELLED',
    actorId: user.id,
    actorRole: user.role,
    cancelReason,
    note: cancelReason ? `Cancelación: ${cancelReason}` : null
  });
  return deliveryOK(row);
}

async function handleTrust(id: string, user: PublicUser) {
  const current = await getDeliveryRequest(id);
  if (!current) return err('Carrera no encontrada', 404);
  if (current.requester_id !== user.id) return err('Solo el solicitante puede confiar', 403);
  const row = await trustDelivery(id, user.id);
  if (!row) return err('Solo se puede confiar tras la entrega', 400);
  return deliveryOK(row);
}