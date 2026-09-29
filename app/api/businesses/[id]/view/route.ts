import { NextRequest, NextResponse } from 'next/server';
import { DbUnavailableError } from '@/lib/db-auth';
import { recordBusinessView } from '@/lib/db-stats';
import { isBusinessId } from '@/lib/ownership-validate';

export const dynamic = 'force-dynamic';

// POST /api/businesses/[id]/view — suma una apertura de ficha.
//
// Público y sin sesión: contar visitas exige contar también las de quien no
// tiene cuenta. Endpoint propio y SIN caché a propósito: los de lectura están
// cacheados y la mayoría de sus peticiones no llegan al servidor, así que
// contar ahí perdería casi todo.
//
// Lo que NO hace: deduplicar por persona. El cliente evita repetir dentro de
// una sesión, pero nada impide inflar el número a mano. Por eso lo que se
// muestra son aperturas, no visitantes únicos.
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isBusinessId(id)) {
    return NextResponse.json({ success: false, error: 'Identificador inválido' }, { status: 400 });
  }

  try {
    const contado = await recordBusinessView(id);
    return NextResponse.json(
      { success: true, counted: contado },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    if (error instanceof DbUnavailableError) {
      // Un contador no merece romperle la ficha a nadie.
      return NextResponse.json(
        { success: false, counted: false },
        { status: 202, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    console.error('[api] POST /api/businesses/[id]/view:', (error as Error)?.message ?? error);
    return NextResponse.json({ success: false, counted: false }, { status: 202 });
  }
}
