import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Términos y Condiciones | TransferCuba',
  description: 'Condiciones de uso de la plataforma TransferCuba.',
};

const SECCIONES: { titulo: string; cuerpo: string[] }[] = [
  {
    titulo: '1. Qué es TransferCuba',
    cuerpo: [
      'TransferCuba es un mapa y directorio informativo de negocios en Cuba que aceptan pagos por transferencia. La plataforma informa sobre métodos de pago y disponibilidad reportada por la comunidad; no procesa pagos ni vende productos.',
      'El servicio lo desarrolla DevParadise (https://devparadise.vercel.app). Contacto: devparadise1102@gmail.com · WhatsApp +5355819421.'
    ]
  },
  {
    titulo: '2. Aceptación obligatoria',
    cuerpo: [
      'Para crear una cuenta debes aceptar estos Términos y Condiciones y la Política de Privacidad marcando la casilla correspondiente. Sin esa aceptación no es posible registrarse y, por tanto, tampoco autenticarse en la plataforma.'
    ]
  },
  {
    titulo: '3. Uso aceptable',
    cuerpo: [
      'Puedes explorar el mapa, registrar negocios, votar, reportar, valorar y solicitar servicios de mensajería para fines lícitos.',
      'Queda prohibido publicar información falsa, suplantar negocios, subir fotos que no te pertenezcan, acosar a otros usuarios o intentar vulnerar la seguridad de la plataforma.'
    ]
  },
  {
    titulo: '4. Publicación de negocios',
    cuerpo: [
      'Todo negocio registrado queda en estado pendiente hasta que un administrador lo revise y apruebe. Solo la información veraz y comprobable será publicada.',
      'Al registrar un negocio declaras que los datos son ciertos y que tienes derecho a publicar las fotografías. Podemos editar, suspender o eliminar fichas que incumplan estas condiciones.'
    ]
  },
  {
    titulo: '5. Verificación comunitaria',
    cuerpo: [
      'Los estados de transferencia activa, votos y reportes los aporta la comunidad y son indicativos, no una garantía. Verifica siempre directamente con el negocio antes de pagar, sobre todo ante cortes eléctricos o caídas de red.'
    ]
  },
  {
    titulo: '6. Tu cuenta',
    cuerpo: [
      'Tu cuenta se identifica con tu número de teléfono y tu PIN. Eres responsable de mantener tu PIN en secreto y de la actividad realizada desde tu cuenta.'
    ]
  },
  {
    titulo: '7. Mensajería y pagos',
    cuerpo: [
      'Los servicios de mensajería se acuerdan entre solicitante y mensajero; la plataforma facilita el contacto y el seguimiento. TransferCuba no interviene en los pagos, que se realizan directamente entre las partes por los canales que acuerden.'
    ]
  },
  {
    titulo: '8. Limitación de responsabilidad',
    cuerpo: [
      'La información del mapa puede estar desactualizada o ser inexacta pese a la moderación. En la medida permitida por la ley, TransferCuba no responde por decisiones de pago, compras o contrataciones basadas en la información publicada.'
    ]
  },
  {
    titulo: '9. Cambios y contacto',
    cuerpo: [
      'Podemos actualizar estos términos para reflejar cambios del servicio; la versión vigente será siempre la de esta página. Para consultas sobre estas condiciones, escríbenos desde la propia plataforma.'
    ]
  }
];

export default function TerminosPage() {
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
          Términos y Condiciones
        </h1>
        <p className="mt-2 text-xs text-slate-500">Vigentes desde septiembre de 2026.</p>

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
          <p className="font-bold">Al usar TransferCuba aceptas estos términos.</p>
          <p className="mt-1 text-slate-300">
            Si no estás de acuerdo con alguno de ellos, por favor deja de utilizar la plataforma.
          </p>
        </div>

        <p className="mt-6 text-xs text-slate-500">
          Relacionado: <Link href="/privacidad" className="font-bold text-cerulean-dark hover:text-cerulean">Política de Privacidad</Link>
        </p>
      </div>
    </main>
  );
}
