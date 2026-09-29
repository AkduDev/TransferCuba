import { NextRequest, NextResponse } from 'next/server';
import { esRutaContable, recordSiteVisit } from '@/lib/db-stats';

export const dynamic = 'force-dynamic';

// POST /api/visit — suma una apertura de página.
//
// Público y sin caché: los endpoints de lectura están cacheados y contar ahí
// perdería casi todo. No se lee ni la IP ni ninguna cabecera identificativa: lo
// único que entra es la ruta, y solo si está en la lista permitida.
export async function POST(req: NextRequest) {
  let body: { path?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  const path = typeof body.path === 'string' ? body.path : '';
  if (!esRutaContable(path)) {
    return NextResponse.json({ success: false, counted: false }, { status: 400 });
  }

  try {
    await recordSiteVisit(path);
    return NextResponse.json(
      { success: true, counted: true },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    // Un contador no puede estropearle la visita a nadie.
    return NextResponse.json({ success: false, counted: false }, { status: 202 });
  }
}
