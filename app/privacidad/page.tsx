import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Política de Privacidad | TransferCuba',
  description: 'Cómo TransferCuba recoge, usa y protege tus datos personales.',
};

const SECCIONES: { titulo: string; cuerpo: string[] }[] = [
  {
    titulo: '1. Quiénes somos',
    cuerpo: [
      'TransferCuba es un mapa y directorio de negocios en Cuba que aceptan pagos por transferencia. Esta política explica qué datos recogemos, para qué los usamos y qué derechos tienes sobre ellos.'
    ]
  },
  {
    titulo: '2. Datos que recogemos',
    cuerpo: [
      'Cuenta: número de teléfono, nombre y PIN de acceso. El PIN se guarda cifrado y nunca se muestra ni se comparte.',
      'Negocios que registras: nombre comercial, categoría, descripción, dirección, horarios, métodos de pago aceptados, WhatsApp, teléfono y fotografías.',
      'Ubicación: solo cuando usas funciones que la requieren (buscar cerca de ti o fijar el punto de tu negocio en el mapa). Puedes escribir la dirección manualmente sin compartir tu GPS.',
      'Actividad en la plataforma: votos, reportes, valoraciones y solicitudes de delivery asociadas a tu cuenta.',
      'Datos técnicos mínimos: una copia local en tu propio navegador para que la app funcione sin conexión.'
    ]
  },
  {
    titulo: '3. Para qué usamos tus datos',
    cuerpo: [
      'Mostrar negocios, fichas, fotos y rutas en el mapa.',
      'Permitirte registrar negocios, votar, reportar, valorar y solicitar servicios de mensajería.',
      'Moderar contenidos y aprobar publicaciones antes de que sean visibles.',
      'Mantener la seguridad de las cuentas y prevenir abusos.'
    ]
  },
  {
    titulo: '4. Servicios externos',
    cuerpo: [
      'Geocodificación y mapas: OpenStreetMap, Nominatim y OSRM reciben las direcciones o coordenadas que consultas para mostrarte resultados y rutas.',
      'Fotografías: las imágenes que subes se alojan en Cloudinary.',
      'No vendemos tus datos ni los compartimos con fines publicitarios.'
    ]
  },
  {
    titulo: '5. Conservación y seguridad',
    cuerpo: [
      'Conservamos tus datos mientras tu cuenta esté activa o mientras sean necesarios para el servicio. Aplicamos controles de acceso: el panel de administración solo está disponible para personal autorizado y las contraseñas de administrador nunca viajan en el código de la página.'
    ]
  },
  {
    titulo: '6. Tus derechos',
    cuerpo: [
      'Puedes pedir en cualquier momento el acceso, la corrección o la eliminación de tus datos personales, así como retirar un negocio que hayas publicado. Escríbenos desde la propia plataforma y atenderemos tu solicitud tras verificar que eres el titular de la cuenta.'
    ]
  },
  {
    titulo: '7. Menores de edad',
    cuerpo: [
      'TransferCuba no está dirigido a menores de 16 años. Si detectamos datos de un menor, los eliminaremos.'
    ]
  },
  {
    titulo: '8. Cambios en esta política',
    cuerpo: [
      'Publicaremos aquí cualquier cambio importante. La versión vigente es la de esta página.'
    ]
  }
];

export default function PrivacidadPage() {
  return (
    <main className="min-h-screen bg-canvas font-sans">
      <div className="mx-auto w-full max-w-2xl px-5 py-8 sm:py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-cerulean-dark hover:text-cerulean transition-colors"
        >
          <span aria-hidden="true">←</span> Volver al mapa
        </Link>
        <p className="mt-6 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
          TransferCuba · Tu plataforma de confianza
        </p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-navy font-display">
          Política de Privacidad
        </h1>
        <p className="mt-2 text-xs text-slate-500">Vigente desde septiembre de 2026.</p>

        <div className="mt-6 space-y-6">
          {SECCIONES.map((s) => (
            <section key={s.titulo}>
              <h2 className="text-base sm:text-lg font-extrabold text-navy">{s.titulo}</h2>
              <div className="mt-1.5 space-y-2">
                {s.cuerpo.map((p, i) => (
                  <p key={i} className="text-sm text-slate-600 leading-relaxed">
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-8 rounded-xl bg-navy text-white p-4 text-xs leading-relaxed">
          <p className="font-bold">¿Dudas sobre tus datos?</p>
          <p className="mt-1 text-slate-300">
            Escríbenos desde la plataforma indicando tu número de teléfono registrado y te
            responderemos tras verificar tu identidad.
          </p>
        </div>
      </div>
    </main>
  );
}
