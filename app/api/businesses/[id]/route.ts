import { NextRequest, NextResponse } from 'next/server';
import { queryBusinessDetails } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/businesses/[id] — detalle completo (DTO BusinessDetails) desde
// las tablas normalizadas V2. Sprint 3 (V2_REFACTOR_PLAN.md, Fase 2.2).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const details = await queryBusinessDetails(id);
    if (!details) {
      return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, business: details });
  } catch (err) {
    console.error('[api] error en GET /api/businesses/[id]:', (err as Error)?.message ?? err);
    return NextResponse.json(
      { success: false, error: 'Servicio temporalmente no disponible' },
      { status: 503 }
    );
  }
}