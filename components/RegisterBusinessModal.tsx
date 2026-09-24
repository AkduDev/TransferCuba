'use client';

import React, { useState, useMemo, useRef } from 'react';
import ModalShell from '@/components/ModalShell';
import { 
  X, 
  Store, 
  MapPin, 
  Check, 
  MessageCircle, 
  ShieldCheck,
  Crosshair,
  AlertCircle,
  CheckCircle2,
  Phone,
  Clock,
  ExternalLink,
  Search as SearchIcon,
  Compass,
  Loader2,
  ImagePlus,
  Trash2
} from 'lucide-react';
import { Business, CUBAN_PROVINCES, CATEGORIES } from '@/lib/cuba-data';
import { searchNominatimAddress, NominatimResult } from '@/lib/nominatim';

interface RegisterBusinessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (newBiz: Omit<Business, 'id' | 'rating' | 'reviewsCount' | 'confirmationsCount' | 'reportsCount' | 'status'>) => Promise<void>;
  pinLocation: { lat: number; lng: number } | null;
  onStartPinning: () => void;
  onPinLocationChange?: (coords: { lat: number; lng: number }) => void;
}

export interface WhatsAppValidationResult {
  isValid: boolean;
  cleanDigits: string; // e.g. "5352849102"
  formatted: string; // e.g. "+53 5284 9102"
  errorMessage?: string;
  isCubanMobile: boolean;
  isInternational: boolean;
  digitsCount: number;
  waLink?: string;
}

/**
 * Validates Cuban and international WhatsApp numbers.
 * In Cuba, mobile lines are 8 digits starting with 5 (or 6), prefixed with +53 internationally.
 */
export function validateWhatsAppNumber(input: string): WhatsAppValidationResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      isValid: false,
      cleanDigits: '',
      formatted: '',
      isCubanMobile: false,
      isInternational: false,
      digitsCount: 0,
      errorMessage: 'Añade un WhatsApp para que tus clientes puedan contactarte directamente.'
    };
  }

  const startsWithPlus = trimmed.startsWith('+');
  const digitsOnly = trimmed.replace(/\D/g, '');

  // Case A: Foreign international number with explicit '+' prefix (e.g. +1 786..., +34...)
  if (startsWithPlus && !digitsOnly.startsWith('53')) {
    if (digitsOnly.length >= 8 && digitsOnly.length <= 15) {
      return {
        isValid: true,
        cleanDigits: digitsOnly,
        formatted: `+${digitsOnly}`,
        isCubanMobile: false,
        isInternational: true,
        digitsCount: digitsOnly.length,
        waLink: `https://wa.me/${digitsOnly}`
      };
    } else {
      return {
        isValid: false,
        cleanDigits: digitsOnly,
        formatted: `+${digitsOnly}`,
        isCubanMobile: false,
        isInternational: true,
        digitsCount: digitsOnly.length,
        errorMessage: 'Incluye el código del país y entre 8 y 15 dígitos, por ejemplo +34 612 345 678.'
      };
    }
  }

  // Case B: Cuban mobile number
  // Can be typed as:
  // - "52849102" (8 digits, starts with 5 or 6)
  // - "052849102" (starts with 05)
  // - "53 5284 9102" (10 digits, starts with 535)
  // - "+53 5284 9102"
  // - "053 5284 9102"
  let cubanNationalMobile = '';

  if (digitsOnly.startsWith('53') && digitsOnly.length >= 3) {
    // Has country code 53...
    cubanNationalMobile = digitsOnly.slice(2);
  } else if (digitsOnly.startsWith('05') && digitsOnly.length >= 2) {
    // Cuban local dialing with 0...
    cubanNationalMobile = digitsOnly.slice(1);
  } else if (digitsOnly.startsWith('5') || digitsOnly.startsWith('6')) {
    cubanNationalMobile = digitsOnly;
  } else if (digitsOnly.length > 0) {
    // Starts with something other than 5, 6, 53, or 05
    // Check if it looks like a Cuban landline (e.g. starts with 7 for Havana)
    if (digitsOnly.startsWith('7')) {
      return {
        isValid: false,
        cleanDigits: digitsOnly,
        formatted: trimmed,
        isCubanMobile: false,
        isInternational: false,
        digitsCount: digitsOnly.length,
        errorMessage: 'Los números que empiezan por 7 son fijos en La Habana. Usa un móvil para WhatsApp.'
      };
    }

    return {
      isValid: false,
      cleanDigits: digitsOnly,
      formatted: trimmed,
      isCubanMobile: false,
      isInternational: false,
      digitsCount: digitsOnly.length,
      errorMessage: 'Usa un móvil cubano que empiece por 5 o 6, por ejemplo +53 5284 9102.'
    };
  }

  // If we have a cubanNationalMobile fragment:
  if (cubanNationalMobile) {
    // Check first digit of national mobile
    if (!cubanNationalMobile.startsWith('5') && !cubanNationalMobile.startsWith('6')) {
      return {
        isValid: false,
        cleanDigits: `53${cubanNationalMobile}`,
        formatted: `+53 ${cubanNationalMobile}`,
        isCubanMobile: true,
        isInternational: false,
        digitsCount: cubanNationalMobile.length,
        errorMessage: 'Los móviles cubanos empiezan por 5 o 6. Revisa el primer dígito.'
      };
    }

    if (cubanNationalMobile.length === 8) {
      const fullDigits = `53${cubanNationalMobile}`;
      const formatted = `+53 ${cubanNationalMobile.slice(0, 4)} ${cubanNationalMobile.slice(4)}`;
      return {
        isValid: true,
        cleanDigits: fullDigits,
        formatted,
        isCubanMobile: true,
        isInternational: false,
        digitsCount: 8,
        waLink: `https://wa.me/${fullDigits}`
      };
    } else if (cubanNationalMobile.length < 8) {
      const remaining = 8 - cubanNationalMobile.length;
      return {
        isValid: false,
        cleanDigits: `53${cubanNationalMobile}`,
        formatted: `+53 ${cubanNationalMobile}`,
        isCubanMobile: true,
        isInternational: false,
        digitsCount: cubanNationalMobile.length,
        errorMessage: `Añade ${remaining} dígito${remaining > 1 ? 's' : ''} para completar tu número.`
      };
    } else {
      return {
        isValid: false,
        cleanDigits: `53${cubanNationalMobile}`,
        formatted: `+53 ${cubanNationalMobile}`,
        isCubanMobile: true,
        isInternational: false,
        digitsCount: cubanNationalMobile.length,
        errorMessage: `El móvil cubano debe tener 8 dígitos. Has escrito ${cubanNationalMobile.length}.`
      };
    }
  }

  return {
    isValid: false,
    cleanDigits: digitsOnly,
    formatted: trimmed,
    isCubanMobile: false,
    isInternational: false,
    digitsCount: digitsOnly.length,
    errorMessage: 'Escribe un móvil válido: +53 5284 9102 o 52849102.'
  };
}

const STEPS = [
  { title: 'Tu negocio', icon: Store },
  { title: 'Ubicación', icon: MapPin },
  { title: 'Formas de pago', icon: ShieldCheck },
  { title: 'Contacto', icon: MessageCircle },
  { title: 'Fotos y envío', icon: ImagePlus },
];

export default function RegisterBusinessModal({
  isOpen,
  onClose,
  onSubmit,
  pinLocation,
  onStartPinning,
  onPinLocationChange
}: RegisterBusinessModalProps) {
  // Nominatim OSM Search State
  const [nominatimQuery, setNominatimQuery] = useState('');
  const [nominatimResults, setNominatimResults] = useState<NominatimResult[]>([]);
  const [isSearchingNominatim, setIsSearchingNominatim] = useState(false);
  const [nominatimSearched, setNominatimSearched] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [category, setCategory] = useState('tiendas');
  const [province, setProvince] = useState('La Habana');
  const [municipality, setMunicipality] = useState('Plaza de la Revolución');
  const [neighborhood, setNeighborhood] = useState('');
  const [address, setAddress] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [phone, setPhone] = useState('');
  const [hours, setHours] = useState('08:30 — 19:00');
  const [description, setDescription] = useState('');
  
  // Payment methods
  const [acceptsTransfer, setAcceptsTransfer] = useState(true);
  const [transfermovil, setTransfermovil] = useState(true);
  const [enzona, setEnzona] = useState(true);
  const [qrPayment, setQrPayment] = useState(true);
  const [onlineGateway, setOnlineGateway] = useState(false);
  const [cash, setCash] = useState(true);

  // Transfer Active Now
  const [transferActiveNow, setTransferActiveNow] = useState(true);

  // Touched tracking for real-time validation display
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Photos upload state
  const [uploadedPhotos, setUploadedPhotos] = useState<{ url: string; alt: string; publicId: string }[]>([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(0);
  const [highestStep, setHighestStep] = useState(0);
  const [stepDirection, setStepDirection] = useState<'forward' | 'backward'>('forward');
  const formRef = useRef<HTMLFormElement>(null);

  // Helper to mark a field as touched on blur or change
  const markTouched = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  // Photo upload handler — sube directamente a Cloudinary (unsigned)
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset) {
      setPhotoError('Fotos no configuradas. Contacta al administrador.');
      return;
    }

    setPhotoError(null);
    setIsUploadingPhoto(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 5 * 1024 * 1024) {
          setPhotoError(`${file.name} excede 5MB — omitido.`);
          continue;
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', uploadPreset);
        formData.append('folder', 'businesses');

        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/upload`,
          { method: 'POST', body: formData }
        );

        const body = await res.json() as {
          secure_url?: string;
          public_id?: string;
          error?: { message?: string };
        } | null;

        if (res.ok && body?.secure_url && body?.public_id) {
          setUploadedPhotos(prev => [...prev, { url: body.secure_url!, alt: file.name, publicId: body.public_id! }]);
        } else {
          setPhotoError(body?.error?.message ?? `Error subiendo ${file.name}`);
        }
      }
    } catch {
      setPhotoError('Error de red al subir imagen.');
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removePhoto = (index: number) => {
    setUploadedPhotos(prev => prev.filter((_, i) => i !== index));
  };

  // Real-time WhatsApp validation calculation
  const waValidation = useMemo(() => {
    return validateWhatsAppNumber(whatsapp);
  }, [whatsapp]);

  // Real-time Name validation
  const nameValidation = useMemo(() => {
    const trimmed = name.trim();
    if (!trimmed) {
      return { isValid: false, message: 'Escribe el nombre con el que te reconocen tus clientes.' };
    }
    if (trimmed.length < 3) {
      return { isValid: false, message: 'Escribe al menos 3 caracteres para identificar tu negocio.' };
    }
    if (trimmed.length > 60) {
      return { isValid: false, message: 'Reduce el nombre a 60 caracteres o menos.' };
    }
    return { isValid: true };
  }, [name]);

  // Real-time Address validation
  const addressValidation = useMemo(() => {
    const trimmed = address.trim();
    if (!trimmed) {
      return { isValid: false, message: 'Añade la dirección donde atiendes a tus clientes.' };
    }
    if (trimmed.length < 5) {
      return { isValid: false, message: 'Incluye calle, número y al menos una entrecalle.' };
    }
    return { isValid: true };
  }, [address]);

  // Payment methods validation
  const paymentValidation = useMemo(() => {
    if (!acceptsTransfer) {
      return { isValid: true };
    }
    const hasAtLeastOneMethod = transfermovil || enzona || qrPayment || onlineGateway;
    if (!hasAtLeastOneMethod) {
      return { 
        isValid: false, 
        message: 'Selecciona al menos una forma de pago digital: Transfermóvil, EnZona, QR o pago en línea.'
      };
    }
    return { isValid: true };
  }, [acceptsTransfer, transfermovil, enzona, qrPayment, onlineGateway]);

  // Optional landline phone validation
  const phoneValidation = useMemo(() => {
    const trimmed = phone.trim();
    if (!trimmed) return { isValid: true };
    const digitsOnly = trimmed.replace(/\D/g, '');
    if (digitsOnly.length < 6 || digitsOnly.length > 12) {
      return { isValid: false, message: 'Revisa el teléfono: debe tener entre 6 y 12 dígitos.' };
    }
    return { isValid: true };
  }, [phone]);

  // Form Overall Validity
  const isFormValid = nameValidation.isValid &&
                       addressValidation.isValid &&
                       waValidation.isValid &&
                       paymentValidation.isValid &&
                       phoneValidation.isValid;

  const stepValid = [
    nameValidation.isValid,
    addressValidation.isValid,
    paymentValidation.isValid,
    waValidation.isValid && phoneValidation.isValid,
    isFormValid,
  ];

  const goToStep = (i: number) => {
    if (i < 0 || i >= STEPS.length || i > highestStep) return;
    if (i > step && stepValid.slice(step, i).some((valid) => !valid)) return;
    if (i === step) return;
    setStepDirection(i > step ? 'forward' : 'backward');
    setStep(i);
    formRef.current?.scrollTo({ top: 0 });
  };

  const goNext = () => {
    if (!stepValid[step] || step >= STEPS.length - 1) return;
    const next = step + 1;
    setStepDirection('forward');
    setStep(next);
    setHighestStep((h) => Math.max(h, next));
    formRef.current?.scrollTo({ top: 0 });
  };

  const goBack = () => {
    if (step <= 0) return;
    setStepDirection('backward');
    setStep(step - 1);
    formRef.current?.scrollTo({ top: 0 });
  };

  const stepAnimation =
    stepDirection === 'forward'
      ? 'animate-in fade-in slide-in-from-right-4 duration-300'
      : 'animate-in fade-in slide-in-from-left-4 duration-300';

  const currentProvinceData = CUBAN_PROVINCES.find(p => p.name === province) || CUBAN_PROVINCES[0];

  const handleProvinceChange = (newProv: string) => {
    setProvince(newProv);
    const pData = CUBAN_PROVINCES.find(p => p.name === newProv);
    if (pData && pData.municipalities.length > 0) {
      setMunicipality(pData.municipalities[0]);
    }
  };

  // Quick auto-fix or format WhatsApp
  const handleAutoFormatWhatsApp = () => {
    if (waValidation.formatted) {
      setWhatsapp(waValidation.formatted);
      markTouched('whatsapp');
    }
  };

  const handleClose = () => {
    setStep(0);
    setHighestStep(0);
    setShowAllErrors(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowAllErrors(true);

    if (step < STEPS.length - 1) {
      if (step === 3) markTouched('phone');
      return;
    }

    if (!isFormValid || isSubmitting) {
      // Find first error element and scroll/focus
      return;
    }

    // Use current pin location or fallback to province center
    const lat = pinLocation ? pinLocation.lat : currentProvinceData.center[0] + (Math.random() - 0.5) * 0.01;
    const lng = pinLocation ? pinLocation.lng : currentProvinceData.center[1] + (Math.random() - 0.5) * 0.01;

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        category,
        categoryIcon: category === 'comida' ? 'Utensils' : category === 'farmacias' ? 'Pill' : 'ShoppingBag',
        description: description.trim() || `Negocio con atención de calidad en ${municipality}, ${province}.`,
        province,
        municipality,
        neighborhood: neighborhood.trim() || undefined,
        address: address.trim(),
        lat,
        lng,
        acceptsTransfer,
        transferActiveNow,
        transferDetails: {
          transfermovil,
          enzona,
          qrPayment,
          onlineGateway,
          cash
        },
        transferVerified: false,
        lastStatusUpdate: 'Pendiente de aprobación por administración',
        lastUpdatedDate: new Date().toISOString(),
        hours: hours.trim() || '09:00 — 18:00',
        whatsapp: waValidation.formatted || whatsapp.trim(),
        phone: phone.trim() || '+53 7830 1234',
        photos: uploadedPhotos.map(p => p.url),
        featured: false
      });
    } finally {
      setIsSubmitting(false);
      handleClose();
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={handleClose}
      labelledBy="register-modal-title"
      describedBy="register-modal-subtitle"
      backdropClassName="bg-navy-deep/60 backdrop-blur-sm"
      overlayClassName="z-50 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:p-5 sm:pb-5"
      panelClassName="bg-white rounded-xl sm:rounded-lg shadow-level-4 border border-border-subtle w-full max-w-xl max-h-[calc(100dvh-1.5rem)] sm:max-h-[94vh] animate-in fade-in zoom-in-95 duration-200"
    >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 sm:py-4 bg-navy text-white flex items-start justify-between gap-3 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-brand text-white text-xs">
                <Store className="w-4 h-4" aria-hidden="true" />
              </span>
              <h2 id="register-modal-title" className="text-base sm:text-lg font-extrabold">Haz visible tu negocio</h2>
            </div>
            <p id="register-modal-subtitle" className="text-[11px] sm:text-xs text-slate-300 mt-1 max-w-md leading-relaxed">
              Crea tu ficha, muestra cómo aceptan pagos y ayuda a más clientes a encontrarte.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Cerrar registro"
            title="Cerrar registro"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/10 text-slate-200 hover:bg-white/20 hover:text-white active:scale-95 transition-all"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Form Body */}
        <form ref={formRef} onSubmit={handleSubmit} noValidate className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">

          <div className="flex-shrink-0" aria-label="Progreso del registro">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[11px] font-bold text-slate-500">
                Paso {step + 1} de {STEPS.length}: <span className="text-navy">{STEPS[step].title}</span>
              </p>
              <p className="text-[11px] font-mono text-slate-400">
                {Math.round(((step + 1) / STEPS.length) * 100)}%
              </p>
            </div>
            <div
              className="h-1.5 rounded-full bg-slate-100 overflow-hidden mb-2.5"
              role="progressbar"
              aria-valuenow={step + 1}
              aria-valuemin={1}
              aria-valuemax={STEPS.length}
              aria-label={`Paso ${step + 1} de ${STEPS.length}`}
            >
              <div
                className="h-full rounded-full bg-emerald-brand transition-all duration-300"
                style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
              />
            </div>
            <ol className="flex items-center gap-1">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const done = i < step || (i <= highestStep && stepValid[i]);
                const current = i === step;
                const reachable = i <= highestStep && (i <= step || stepValid.slice(step, i).every(Boolean));
                return (
                  <li key={s.title} className="flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => goToStep(i)}
                      disabled={!reachable}
                      aria-label={`Ir al paso ${i + 1}: ${s.title}`}
                      aria-current={current ? 'step' : undefined}
                      className={`min-h-11 w-full flex items-center justify-center gap-1 px-1 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${
                        current
                          ? 'bg-navy text-white shadow-level-1'
                          : done
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : reachable
                          ? 'bg-white text-slate-500 border border-border-subtle hover:bg-slate-50'
                          : 'bg-white text-slate-300 border border-border-subtle cursor-not-allowed'
                      }`}
                    >
                      {done && !current ? (
                        <Check className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                      ) : (
                        <Icon className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                      )}
                      <span className="truncate hidden min-[420px]:inline">{s.title}</span>
                      <span className="min-[420px]:hidden">{i + 1}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Section 1: Business Info */}
          <div className={step === 0 ? `space-y-3 ${stepAnimation}` : 'hidden'}>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-navy">Haz que te encuentren desde el primer vistazo</h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 mb-4 leading-relaxed">
                Empieza con lo esencial. Podrás completar el resto antes de enviar tu solicitud.
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Commercial Name */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-600">
                    Nombre que verán tus clientes *
                  </label>
                  {name.length > 0 && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      {name.length}/60
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      markTouched('name');
                    }}
                    onBlur={() => markTouched('name')}
                    placeholder="Ej. Café & Market Habana"
                    className={`w-full min-h-11 text-base sm:text-sm px-3 py-2.5 sm:py-2 pr-9 rounded-lg border transition-all ${
                      (touched.name || showAllErrors) && !nameValidation.isValid
                        ? 'border-crimson/50 focus:ring-2 focus:ring-crimson/25 bg-ez-bg/40'
                        : touched.name && nameValidation.isValid
                        ? 'border-emerald-500 focus:ring-2 focus:ring-emerald-brand/25 bg-emerald-50/10'
                        : 'border-border-subtle focus:ring-2 focus:ring-cerulean/25 focus:border-cerulean'
                    }`}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    {touched.name && nameValidation.isValid && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-brand animate-in zoom-in-50" />
                    )}
                    {(touched.name || showAllErrors) && !nameValidation.isValid && (
                      <AlertCircle className="w-4 h-4 text-rose-500 animate-in zoom-in-50" />
                    )}
                  </div>
                </div>
                {(touched.name || showAllErrors) && !nameValidation.isValid && (
                  <p className="text-[11px] text-crimson mt-1 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    <span>{nameValidation.message}</span>
                  </p>
                )}
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  ¿Qué vendes o prestas?
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full min-h-11 text-base sm:text-sm px-3 py-2.5 sm:py-2 rounded-lg border border-border-subtle focus:outline-none focus:ring-2 focus:ring-cerulean/25 focus:border-cerulean bg-white"
                >
                  {CATEGORIES.filter(c => c.id !== 'all').map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-600">
                  En una frase, ¿qué vendes o prestas?
                </label>
                <span className="text-[10px] text-slate-400 font-mono">
                  {description.length}/200
                </span>
              </div>
              <textarea
                value={description}
                maxLength={200}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej. Pan recién hecho, pizzas, refrescos fríos y pago directo por QR."
                rows={2}
                className="w-full min-h-11 text-base sm:text-sm px-3 py-2.5 sm:py-2 rounded-lg border border-border-subtle focus:outline-none focus:ring-2 focus:ring-cerulean/25 focus:border-cerulean"
              />
            </div>
          </div>

          {/* Section 2: Location details */}
          <div className={step === 1 ? `space-y-3 pt-3 border-t border-slate-100 ${stepAnimation}` : 'hidden'}>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-navy">Una ubicación precisa hace más fácil llegar</h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 mb-4 leading-relaxed">
                Así tus clientes podrán encontrarte y llegar sin pedir indicaciones.
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Provincia</label>
                <select
                  value={province}
                  onChange={(e) => handleProvinceChange(e.target.value)}
                  className="w-full min-h-11 text-base sm:text-sm px-3 py-2.5 sm:py-2 rounded-lg border border-border-subtle focus:outline-none focus:ring-2 focus:ring-cerulean/25 focus:border-cerulean bg-white"
                >
                  {CUBAN_PROVINCES.map(p => (
                    <option key={p.name} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Municipio</label>
                <select
                  value={municipality}
                  onChange={(e) => setMunicipality(e.target.value)}
                  className="w-full min-h-11 text-base sm:text-sm px-3 py-2.5 sm:py-2 rounded-lg border border-border-subtle focus:outline-none focus:ring-2 focus:ring-cerulean/25 focus:border-cerulean bg-white"
                >
                  {currentProvinceData.municipalities.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Address */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Dirección donde pueden encontrarte *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value);
                      markTouched('address');
                    }}
                    onBlur={() => markTouched('address')}
                    placeholder="Ej. Calle 23 #456 e/ J e I"
                    className={`w-full min-h-11 text-base sm:text-sm px-3 py-2.5 sm:py-2 pr-9 rounded-lg border transition-all ${
                      (touched.address || showAllErrors) && !addressValidation.isValid
                        ? 'border-crimson/50 focus:ring-2 focus:ring-crimson/25 bg-ez-bg/40'
                        : touched.address && addressValidation.isValid
                        ? 'border-emerald-500 focus:ring-2 focus:ring-emerald-brand/25 bg-emerald-50/10'
                        : 'border-border-subtle focus:ring-2 focus:ring-cerulean/25 focus:border-cerulean'
                    }`}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    {touched.address && addressValidation.isValid && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-brand animate-in zoom-in-50" />
                    )}
                    {(touched.address || showAllErrors) && !addressValidation.isValid && (
                      <AlertCircle className="w-4 h-4 text-rose-500 animate-in zoom-in-50" />
                    )}
                  </div>
                </div>
                {(touched.address || showAllErrors) && !addressValidation.isValid && (
                  <p className="text-[11px] text-crimson mt-1 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    <span>{addressValidation.message}</span>
                  </p>
                )}
              </div>

              {/* Neighborhood */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Reparto o zona (opcional)
                </label>
                <input
                  type="text"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  placeholder="ej. Vedado / Miramar / Santos Suárez"
                  className="w-full min-h-11 text-base sm:text-sm px-3 py-2.5 sm:py-2 rounded-lg border border-border-subtle focus:outline-none focus:ring-2 focus:ring-cerulean/25 focus:border-cerulean"
                />
              </div>
            </div>

            {/* Asistente Nominatim OpenStreetMap (Opción B del usuario) */}
            <div className="p-3 bg-slate-50/90 rounded-lg border border-border-subtle space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-cerulean-dark" />
                  <span>Encuentra tu dirección más rápido</span>
                </span>
                <span className="text-[10px] text-slate-400 font-semibold">OpenStreetMap</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Escribe la dirección y selecciona el resultado para colocar el pin automáticamente.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nominatimQuery}
                  onChange={(e) => setNominatimQuery(e.target.value)}
                  placeholder={address.trim() ? address : 'ej. Calle 23 e/ L y M, Vedado'}
                  className="flex-1 min-h-11 text-base sm:text-sm px-2.5 py-2 rounded-lg border border-border-strong bg-white focus:outline-none focus:ring-1 focus:ring-cerulean/25"
                />
                <button
                  type="button"
                  onClick={async () => {
                    const q = nominatimQuery.trim() || address.trim();
                    if (!q) return;
                    setIsSearchingNominatim(true);
                    setNominatimSearched(true);
                    const res = await searchNominatimAddress(q, province);
                    setNominatimResults(res);
                    setIsSearchingNominatim(false);
                  }}
                  disabled={isSearchingNominatim}
                  className="min-h-11 px-3 py-2 bg-cerulean hover:bg-cerulean-dark text-white text-xs font-bold rounded-lg shadow-level-1 flex items-center justify-center gap-1 transition-colors flex-shrink-0"
                >
                  <SearchIcon className="w-3 h-3" />
                  <span>{isSearchingNominatim ? 'Buscando…' : 'Buscar dirección'}</span>
                </button>
              </div>

              {nominatimResults.length > 0 && (
                <div className="p-2 bg-white rounded-lg border border-tm-border space-y-1 max-h-36 overflow-y-auto">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Elige la dirección correcta:</p>
                  {nominatimResults.map((item) => (
                    <button
                      key={item.place_id}
                      type="button"
                      onClick={() => {
                        const lat = parseFloat(item.lat);
                        const lng = parseFloat(item.lon);
                        if (!isNaN(lat) && !isNaN(lng)) {
                          if (onPinLocationChange) {
                            onPinLocationChange({ lat, lng });
                          }
                          if (!address.trim()) {
                            setAddress(item.display_name.split(',')[0] || item.display_name);
                          }
                          setNominatimResults([]);
                        }
                      }}
                      className="w-full text-left p-1.5 hover:bg-tm-bg rounded text-[11px] text-slate-600 border-b border-slate-100 last:border-0 flex items-start gap-1.5 transition-colors"
                    >
                      <MapPin className="w-3 h-3 text-emerald-brand flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{item.display_name}</span>
                    </button>
                  ))}
                </div>
              )}
              {nominatimSearched && nominatimResults.length === 0 && !isSearchingNominatim && (
                <p className="text-[11px] text-slate-500 italic">
                  No encontramos una coincidencia exacta. Prueba otra referencia o fija el punto manualmente en el mapa.
                </p>
              )}
            </div>

            {/* Visual Map Pin Placement */}
            <div className={`p-3 rounded-lg border transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
              pinLocation 
                ? 'bg-emerald-50/60 border-emerald-200' 
                : 'bg-tm-bg border-tm-border'
            }`}>
              <div className="flex items-start gap-2.5">
                <MapPin className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                  pinLocation ? 'text-emerald-brand' : 'text-cerulean-dark'
                }`} />
                <div>
                  <div className="flex items-center gap-2">
                    <p className={`text-xs font-bold ${pinLocation ? 'text-emerald-950' : 'text-blue-950'}`}>
                      {pinLocation ? 'Ubicación precisa fijada' : 'Fija el punto exacto de tu local'}
                    </p>
                    {pinLocation && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-brand text-[10px] text-white font-bold">
                        Confirmado
                      </span>
                    )}
                  </div>
                  <p className={`text-[11px] mt-0.5 ${pinLocation ? 'text-emerald-700 font-mono' : 'text-cerulean-dark'}`}>
                    {pinLocation 
                      ? `Lat: ${pinLocation.lat.toFixed(5)}, Lng: ${pinLocation.lng.toFixed(5)}` 
                      : 'Un punto exacto ayuda a tus clientes a llegar sin pedir indicaciones.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onStartPinning}
                className={`w-full sm:w-auto min-h-11 px-3.5 py-2 rounded-lg text-white text-xs font-semibold shadow-level-1 flex items-center justify-center gap-1.5 flex-shrink-0 transition-colors ${
                  pinLocation ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-cerulean hover:bg-cerulean-dark'
                }`}
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>{pinLocation ? 'Mover punto' : 'Abrir mapa y fijar ubicación'}</span>
              </button>
            </div>
          </div>

          {/* Section 3: Payment Methods */}
          <div className={step === 2 ? `space-y-3 pt-3 border-t border-slate-100 ${stepAnimation}` : 'hidden'}>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-navy">Muestra cómo pueden pagarte</h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
                  Selecciona todas las opciones que aceptas. Aparecerán en tu ficha y en los filtros del mapa.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAcceptsTransfer(!acceptsTransfer)}
                className={`min-h-11 inline-flex items-center justify-center gap-1.5 text-xs font-bold px-3 rounded-lg transition-colors ${
                  acceptsTransfer
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                {acceptsTransfer ? 'Acepto transferencias' : 'Mostrar solo efectivo'}
              </button>
            </div>

            {acceptsTransfer && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <label className={`min-h-12 flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  transfermovil ? 'border-emerald-300 bg-emerald-50/50' : 'border-border-subtle hover:bg-slate-50'
                }`}>
                  <input
                    type="checkbox"
                    checked={transfermovil}
                    onChange={(e) => {
                      setTransfermovil(e.target.checked);
                      markTouched('payments');
                    }}
                    className="rounded text-emerald-brand focus:ring-emerald-brand/25"
                  />
                  <span className="font-semibold text-slate-600">Transfermóvil</span>
                </label>

                <label className={`min-h-12 flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  enzona ? 'border-tm-border bg-tm-bg/50' : 'border-border-subtle hover:bg-slate-50'
                }`}>
                  <input
                    type="checkbox"
                    checked={enzona}
                    onChange={(e) => {
                      setEnzona(e.target.checked);
                      markTouched('payments');
                    }}
                    className="rounded text-cerulean-dark focus:ring-cerulean/25"
                  />
                  <span className="font-semibold text-slate-600">EnZona</span>
                </label>

                <label className={`min-h-12 flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  qrPayment ? 'border-indigo-300 bg-indigo-50/50' : 'border-border-subtle hover:bg-slate-50'
                }`}>
                  <input
                    type="checkbox"
                    checked={qrPayment}
                    onChange={(e) => {
                      setQrPayment(e.target.checked);
                      markTouched('payments');
                    }}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-semibold text-slate-600">Código QR en Caja</span>
                </label>

                <label className={`min-h-12 flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  onlineGateway ? 'border-purple-300 bg-purple-50/50' : 'border-border-subtle hover:bg-slate-50'
                }`}>
                  <input
                    type="checkbox"
                    checked={onlineGateway}
                    onChange={(e) => {
                      setOnlineGateway(e.target.checked);
                      markTouched('payments');
                    }}
                    className="rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span className="font-semibold text-slate-600">Pago en línea</span>
                </label>

                <label className={`min-h-12 flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  cash ? 'border-border-strong bg-slate-100/50' : 'border-border-subtle hover:bg-slate-50'
                }`}>
                  <input
                    type="checkbox"
                    checked={cash}
                    onChange={(e) => setCash(e.target.checked)}
                    className="rounded text-slate-600 focus:ring-slate-500"
                  />
                  <span className="font-semibold text-slate-600">Efectivo CUP</span>
                </label>
              </div>
            )}

            {/* Error if acceptsTransfer is true but no gateway is checked */}
            {(touched.payments || showAllErrors) && !paymentValidation.isValid && (
              <p className="text-[11px] text-crimson mt-1 flex items-center gap-1 font-medium bg-ez-bg/50 p-2 rounded-lg border border-ez-border">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-crimson" />
                <span>{paymentValidation.message}</span>
              </p>
            )}

            {/* Real-time transfer status at moment of opening */}
            <div className="p-3 rounded-xl bg-slate-50 border border-border-subtle flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-3">
              <div>
                <p className="text-sm font-bold text-navy">
                  ¿Pueden transferirte ahora mismo?
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  Mantén el estado actualizado para que tus clientes sepan si pueden pagar en este momento.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setTransferActiveNow(true)}
                  className={`min-h-11 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    transferActiveNow
                      ? 'bg-emerald-brand text-white shadow-level-1'
                      : 'bg-white text-slate-600 border border-border-subtle'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${transferActiveNow ? 'bg-white' : 'bg-emerald-brand'}`} />
                  Sí, está activa
                </button>
                <button
                  type="button"
                  onClick={() => setTransferActiveNow(false)}
                  className={`min-h-11 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    !transferActiveNow
                      ? 'bg-saffron text-white shadow-level-1'
                      : 'bg-white text-slate-600 border border-border-subtle'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${!transferActiveNow ? 'bg-white' : 'bg-saffron'}`} />
                  No por ahora
                </button>
              </div>
            </div>
          </div>

          {/* Section 4: Contact and WhatsApp Validation (HIGHLIGHT FEATURE) */}
          <div className={step === 3 ? `space-y-3 pt-3 border-t border-slate-100 ${stepAnimation}` : 'hidden'}>
            <div className="mb-4">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-emerald-brand" />
                <h3 className="text-base sm:text-lg font-extrabold text-navy">Convierte visitas en contactos</h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
                Comparte tu WhatsApp para que los clientes te escriban directamente desde tu ficha.
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* WHATSAPP INPUT WITH REAL-TIME VALIDATION */}
              <div className="sm:col-span-2">
                <div className="mb-1">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <span>WhatsApp para recibir clientes</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Usa un móvil cubano de 8 dígitos que empiece por 5 o 6.
                  </p>
                </div>

                {/* Input with prefix badge */}
                <div className="relative flex rounded-xl shadow-level-1">
                  <div className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-border-subtle bg-slate-50 text-slate-600 text-xs font-bold gap-1.5 select-none flex-shrink-0">
                    <span className="text-base leading-none">🇨🇺</span>
                    <span>+53</span>
                  </div>

                  <input
                    type="tel"
                    required
                    value={whatsapp}
                    onChange={(e) => {
                      setWhatsapp(e.target.value);
                      markTouched('whatsapp');
                    }}
                    onBlur={() => markTouched('whatsapp')}
                    placeholder="5284 9102  o  +53 5284 9102"
                    className={`flex-1 min-w-0 min-h-11 text-base sm:text-sm px-3 py-2.5 pr-10 rounded-r-xl border transition-all font-mono ${
                      (touched.whatsapp || showAllErrors) && !waValidation.isValid
                        ? 'border-crimson/50 focus:ring-2 focus:ring-crimson/25 bg-ez-bg/40'
                        : touched.whatsapp && waValidation.isValid
                        ? 'border-emerald-500 focus:ring-2 focus:ring-emerald-brand/25 bg-emerald-50/10 text-emerald-950 font-bold'
                        : 'border-border-subtle focus:ring-2 focus:ring-cerulean/25 focus:border-cerulean'
                    }`}
                  />

                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {touched.whatsapp && waValidation.isValid && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-brand animate-in zoom-in-50" />
                    )}
                    {(touched.whatsapp || showAllErrors) && !waValidation.isValid && (
                      <AlertCircle className="w-5 h-5 text-rose-500 animate-in zoom-in-50" />
                    )}
                  </div>
                </div>

                {/* Real-time Dynamic Feedback Box */}
                <div className="mt-1.5 space-y-1">
                  {/* Invalid or typing feedback */}
                  {(touched.whatsapp || showAllErrors) && !waValidation.isValid && (
                    <div className="p-2 rounded-lg bg-ez-bg/50 border border-ez-border text-[11px] text-crimson flex items-start gap-1.5 animate-in fade-in duration-150">
                      <AlertCircle className="w-3.5 h-3.5 text-crimson mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-semibold">{waValidation.errorMessage}</p>
                        <p className="text-[10px] text-crimson mt-0.5">
                          Ejemplo válido: <span className="font-mono font-bold">+53 5284 9102</span> o simplemente <span className="font-mono font-bold">52849102</span>
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Valid state: green preview with WhatsApp link */}
                  {waValidation.isValid && (
                    <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 flex items-center justify-between gap-2 animate-in fade-in duration-150">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-brand flex-shrink-0" />
                        <span>
                          WhatsApp listo para recibir mensajes: <strong className="font-mono">{waValidation.formatted}</strong>
                          {waValidation.isInternational && ' (Internacional)'}
                        </span>
                      </div>
                      
                      {waValidation.waLink && (
                        <a
                          href={waValidation.waLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-white px-2 py-0.5 rounded border border-emerald-300"
                        >
                          <span>Abrir chat de prueba</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  )}

                  {/* Auto-format action if valid but not formatted */}
                  {waValidation.isValid && waValidation.formatted && whatsapp !== waValidation.formatted && (
                    <button
                      type="button"
                      onClick={handleAutoFormatWhatsApp}
                      className="text-[11px] text-emerald-700 hover:text-emerald-900 font-semibold underline underline-offset-2 flex items-center gap-1 mt-0.5"
                    >
                      <span>Usar formato internacional: {waValidation.formatted}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Optional Phone */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>Teléfono fijo o alternativo (opcional)</span>
                  </label>
                </div>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    markTouched('phone');
                  }}
                  onBlur={() => markTouched('phone')}
                  placeholder="ej. +53 7830 1234 o 78301234"
                  className={`w-full min-h-11 text-base sm:text-sm px-3 py-2.5 sm:py-2 rounded-lg border transition-all ${
                    touched.phone && !phoneValidation.isValid
                      ? 'border-crimson/50 bg-ez-bg/40'
                      : 'border-border-subtle focus:ring-2 focus:ring-cerulean/25 focus:border-cerulean'
                  }`}
                />
                {touched.phone && !phoneValidation.isValid && (
                  <p className="text-[11px] text-crimson mt-1">{phoneValidation.message}</p>
                )}
              </div>

              {/* Business Hours */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>Horario de atención (opcional)</span>
                  </label>
                </div>
                <input
                  type="text"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder="08:00 — 20:00 (Lunes a Sábado)"
                  className="w-full min-h-11 text-base sm:text-sm px-3 py-2.5 sm:py-2 rounded-lg border border-border-subtle focus:outline-none focus:ring-2 focus:ring-cerulean/25 focus:border-cerulean"
                />
              </div>
            </div>
          </div>

          {/* Photo upload */}
          <div className={step === 4 ? `space-y-2 pt-3 border-t border-slate-100 ${stepAnimation}` : 'hidden'}>
            <div className="mb-4">
              <h3 className="text-base sm:text-lg font-extrabold text-navy">Muestra lo mejor de tu negocio</h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
                Las fotos ayudan a tus clientes a identificarte y reconocer tu local antes de llegar.
              </p>
            </div>

            {/* Uploaded photos grid */}
            {uploadedPhotos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {uploadedPhotos.map((photo, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url} alt={photo.alt} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      aria-label={`Eliminar ${photo.alt}`}
                      className="absolute top-1 right-1 p-1 rounded-full bg-red-500/80 text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload button */}
            <label
              className={`min-h-24 flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-dashed transition-colors cursor-pointer
                ${isUploadingPhoto
                  ? 'border-cerulean/40 bg-cerulean/5'
                  : 'border-slate-200 hover:border-cerulean/40 hover:bg-slate-50'
                }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                onChange={handlePhotoUpload}
                className="sr-only"
                disabled={isUploadingPhoto}
              />
              {isUploadingPhoto ? (
                <Loader2 className="w-5 h-5 text-cerulean animate-spin" />
              ) : (
                <ImagePlus className="w-5 h-5 text-slate-400" />
              )}
              <span className="text-xs text-slate-500">
                {isUploadingPhoto ? 'Subiendo tus fotos…' : 'Añadir fotos (opcional, máx. 5 MB por imagen)'}
              </span>
            </label>
            {photoError && (
              <p className="text-[11px] text-red-500 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5">
                {photoError}
              </p>
            )}
            <p className="text-[11px] text-slate-400">
              Si no añades fotos, usaremos el icono de tu categoría.
            </p>
          </div>

          {/* Validation summary banner if submit attempted with errors */}
          {step === 4 && showAllErrors && !isFormValid && (
            <div className="p-3 rounded-xl bg-ez-bg/50 border border-ez-border text-xs text-crimson space-y-1 animate-in fade-in">
              <p className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-crimson flex-shrink-0" />
                Revisa estos datos antes de enviar tu solicitud:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-crimson pl-1 text-[11px]">
                {!nameValidation.isValid && <li>Nombre comercial: {nameValidation.message}</li>}
                {!addressValidation.isValid && <li>Dirección: {addressValidation.message}</li>}
                {!waValidation.isValid && <li>WhatsApp: {waValidation.errorMessage}</li>}
                {!paymentValidation.isValid && <li>Métodos de pago: {paymentValidation.message}</li>}
                {!phoneValidation.isValid && <li>Teléfono: {phoneValidation.message}</li>}
              </ul>
            </div>
          )}

          {/* Submit CTA with Moderation Notice */}
          <div className="pt-4 border-t border-border-subtle space-y-3">
            <div className="p-3 rounded-xl bg-cerulean/5 border border-tm-border text-xs text-slate-600 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-cerulean-dark flex-shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong className="text-navy">Revisión antes de publicar.</strong> Comprobaremos tu información y, cuando se apruebe, tu negocio aparecerá en el mapa y en las búsquedas.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-500 hidden sm:block">
                {step < STEPS.length - 1 ? (
                  stepValid[step] ? (
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-brand" />
                      Sección completa. Continúa cuando quieras.
                    </span>
                  ) : (
                    <span className="text-slate-400">
                      Completa lo obligatorio para continuar
                    </span>
                  )
                ) : isFormValid ? (
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-brand" />
                    Todo listo para enviar tu solicitud
                  </span>
                ) : (
                  <span className="text-slate-400">
                    Revisa los datos antes de enviar
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                {step > 0 && (
                  <button
                    type="button"
                    onClick={goBack}
                    className="flex-1 sm:flex-none px-3 py-2.5 text-sm text-slate-600 hover:text-text-primary font-semibold border border-border-subtle rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    ← Atrás
                  </button>
                )}
                {step < STEPS.length - 1 ? (
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={!stepValid[step]}
                    title={stepValid[step] ? `Continuar a ${STEPS[step + 1].title}` : 'Completa lo obligatorio de esta sección para continuar'}
                    className={`${step === 0 ? 'w-full' : 'flex-[1.5] sm:flex-none'} px-4 sm:px-6 py-2.5 rounded-xl text-white font-bold text-sm shadow-level-2 transition-all flex items-center justify-center gap-2 ${
                      stepValid[step]
                        ? 'bg-navy hover:bg-navy-hover'
                        : 'bg-slate-300 cursor-not-allowed'
                    }`}
                  >
                    <span className="sm:hidden">Continuar</span>
                    <span className="hidden sm:inline">Continuar: {STEPS[step + 1].title}</span>
                    <span aria-hidden="true">→</span>
                  </button>
                ) : (
                  <button
                    type="submit"
                    id="btn-submit-biz"
                    disabled={isSubmitting || !isFormValid}
                    className={`flex-[1.5] sm:flex-none px-4 sm:px-6 py-2.5 rounded-xl text-white font-bold text-sm shadow-level-2 transition-all flex items-center justify-center gap-2 w-full ${
                      isFormValid
                        ? 'bg-emerald-brand hover:bg-emerald-brand shadow-emerald-600/20'
                        : 'bg-slate-300 cursor-not-allowed'
                    } ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Enviando tu negocio…</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Enviar para revisión</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
            {step < STEPS.length - 1 && !stepValid[step] && (
              <p className="text-[11px] text-slate-400 sm:hidden">
                Completa los campos obligatorios para continuar
              </p>
            )}
          </div>
        </form>
    </ModalShell>
  );
}
