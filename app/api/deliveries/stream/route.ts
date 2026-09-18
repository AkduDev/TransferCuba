import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  fetchStreamBatch,
  getMessengerProfile,
  isMessengerSubscriptionActive,
  decodeStreamCursor,
  encodeStreamCursor,
  nuevoStreamCursor,
  DbUnavailableError,
  type StreamCursor
} from '@/lib/db-delivery';
import { toDeliveryDTO, toDeliveryReviewDTO } from '@/lib/delivery-dto';

export const dynamic = 'force-dynamic';

/**
 * Duración máxima de la función. La API no es un servicio aparte: cada
 * `route.ts` es una función serverless con tope de ejecución, así que un SSE
 * no puede quedarse abierto para siempre. El stream se cierra ANTES de que la
 * plataforma lo mate, avisando al cliente para que reconecte con su cursor.
 */
export const maxDuration = 60;

/** Margen para despedirse limpiamente antes del tope de la plataforma. */
const VIDA_DEL_STREAM_MS = 50_000;
/** Cada cuánto se consulta la base por novedades. */
const INTERVALO_SONDEO_MS = 2_000;
/** Latido para que proxies y balanceadores no cierren por inactividad. */
const INTERVALO_LATIDO_MS = 15_000;

function sse(event: string, id: string, data: unknown): string {
  return `event: ${event}\nid: ${id}\ndata: ${JSON.stringify(data)}\n\n`;
}

// GET /api/deliveries/stream — eventos en vivo, filtrados por rol.
// El cliente reconecta con `Last-Event-ID`, que lleva el cursor por fuente.
// Si esto falla, el polling de 12/15 s del cliente sigue funcionando: el
// stream es una mejora, nunca el único camino.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ success: false, error: 'Inicia sesión primero' }), {
      status: auth.status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Un mensajero con la suscripción vencida no recibe el tablón, igual que en
  // `/available`: el stream no puede ser una puerta trasera a esos datos.
  let incluirTablon = false;
  if (auth.user.role === 'MESSENGER') {
    try {
      incluirTablon = isMessengerSubscriptionActive(await getMessengerProfile(auth.user.id));
    } catch (error) {
      if (error instanceof DbUnavailableError) {
        return new Response(
          JSON.stringify({ success: false, error: 'Servicio temporalmente no disponible' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw error;
    }
  }

  const reanudado = decodeStreamCursor(req.headers.get('last-event-id'));
  let cursor: StreamCursor = reanudado ?? nuevoStreamCursor();

  const encoder = new TextEncoder();
  const abort = req.signal;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const nacimiento = Date.now();
      let cerrado = false;
      // Arranca en "ahora": con 0, el primer sondeo disparaba un latido
      // inmediato justo detrás del `ready`, que no aporta nada.
      let ultimoLatido = Date.now();

      const enviar = (texto: string) => {
        if (cerrado) return;
        try {
          controller.enqueue(encoder.encode(texto));
        } catch {
          cerrado = true;
        }
      };

      const cerrar = (motivo: string) => {
        if (cerrado) return;
        enviar(sse('bye', encodeStreamCursor(cursor), { type: 'bye', reason: motivo }));
        cerrado = true;
        try {
          controller.close();
        } catch {
          /* ya cerrado por el cliente */
        }
      };

      abort.addEventListener('abort', () => {
        cerrado = true;
        try {
          controller.close();
        } catch {
          /* el cliente ya se fue */
        }
      });

      // Primer mensaje inmediato: el cliente sabe que la conexión está viva sin
      // esperar al primer sondeo, y recibe el cursor desde el que parte.
      enviar(sse('ready', encodeStreamCursor(cursor), { type: 'ready', resumed: reanudado !== null }));

      while (!cerrado && !abort.aborted) {
        if (Date.now() - nacimiento > VIDA_DEL_STREAM_MS) {
          cerrar('max-duration');
          break;
        }

        try {
          const batch = await fetchStreamBatch(auth.user.id, auth.user.role, cursor, incluirTablon);
          cursor = batch.cursor;

          for (const ev of batch.events) {
            const id = encodeStreamCursor(cursor);
            if (ev.type === 'delivery.reviewed' && ev.review) {
              enviar(sse(ev.type, id, { type: ev.type, review: toDeliveryReviewDTO(ev.review) }));
            } else if (ev.delivery) {
              // Misma regla de privacidad que el JSON: una carrera del tablón
              // no lleva destino ni identidad del solicitante.
              const esTablon = ev.type === 'delivery.available';
              enviar(
                sse(ev.type, id, {
                  type: ev.type,
                  delivery: toDeliveryDTO(ev.delivery, {
                    includeLocations: true,
                    includeRequester: !esTablon,
                    includeMessenger: !esTablon
                  })
                })
              );
            }
          }

          const ahora = Date.now();
          if (batch.events.length === 0 && ahora - ultimoLatido > INTERVALO_LATIDO_MS) {
            ultimoLatido = ahora;
            enviar(sse('heartbeat', encodeStreamCursor(cursor), { type: 'heartbeat', at: ahora }));
          }
        } catch (error) {
          if (error instanceof DbUnavailableError) {
            // La BD caída no tumba el stream: se avisa y el cliente decide
            // (normalmente, caer al polling).
            enviar(sse('db-unavailable', encodeStreamCursor(cursor), { type: 'db-unavailable' }));
            cerrar('db-unavailable');
            break;
          }
          console.error('[api] GET /api/deliveries/stream:', (error as Error)?.message ?? error);
          cerrar('error');
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, INTERVALO_SONDEO_MS));
      }

      if (!cerrado) cerrar('fin');
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Evita que un proxy inverso (nginx) acumule la respuesta en un búfer y
      // la entregue de golpe al cerrar, que anularía todo el sentido del SSE.
      'X-Accel-Buffering': 'no'
    }
  });
}
