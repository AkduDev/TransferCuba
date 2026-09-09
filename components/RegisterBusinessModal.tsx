'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
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
  Sparkles,
  HelpCircle,
  ExternalLink,
  Search as SearchIcon,
  Compass
} from 'lucide-react';
import { Business, CUBAN_PROVINCES, CATEGORIES } from '@/lib/cuba-data';
import { searchNominatimAddress, NominatimResult } from '@/lib/nominatim';

interface RegisterBusinessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (newBiz: Omit<Business, 'id' | 'rating' | 'reviewsCount' | 'confirmationsCount' | 'reportsCount' | 'status'>) => void;
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
      errorMessage: 'El número de WhatsApp es obligatorio para que los clientes puedan contactarte.'
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
        errorMessage: 'Número internacional incompleto. Debe tener entre 8 y 15 dígitos con código de país.'
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
        errorMessage: 'El número 7... corresponde a un teléfono fijo de La Habana. WhatsApp requiere un número móvil celular cubano que comience con 5.'
      };
    }

    return {
      isValid: false,
      cleanDigits: digitsOnly,
      formatted: trimmed,
      isCubanMobile: false,
      isInternational: false,
      digitsCount: digitsOnly.length,
      errorMessage: 'En Cuba, los teléfonos móviles para WhatsApp deben comenzar con 5 (ej: +53 5284 9102).'
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
        errorMessage: 'Los móviles cubanos inician con 5 (ej: 5284 9102). Revisa el primer dígito.'
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
        errorMessage: `Faltan ${remaining} dígito${remaining > 1 ? 's' : ''} (llevas ${cubanNationalMobile.length} de 8 dígitos del móvil cubano).`
      };
    } else {
      return {
        isValid: false,
        cleanDigits: `53${cubanNationalMobile}`,
        formatted: `+53 ${cubanNationalMobile}`,
        isCubanMobile: true,
        isInternational: false,
        digitsCount: cubanNationalMobile.length,
        errorMessage: `El número móvil cubano tiene solo 8 dígitos (+53). Has ingresado ${cubanNationalMobile.length} dígitos.`
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
    errorMessage: 'Ingresa un número móvil cubano válido (ej: +53 5284 9102 o 52849102).'
  };
}

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

  // Photo
  const [selectedPhotoPreset, setSelectedPhotoPreset] = useState('https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=600&q=80');

  // Touched tracking for real-time validation display
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showAllErrors, setShowAllErrors] = useState(false);

  // Helper to mark a field as touched on blur or change
  const markTouched = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  // Real-time WhatsApp validation calculation
  const waValidation = useMemo(() => {
    return validateWhatsAppNumber(whatsapp);
  }, [whatsapp]);

  // Real-time Name validation
  const nameValidation = useMemo(() => {
    const trimmed = name.trim();
    if (!trimmed) {
      return { isValid: false, message: 'El nombre comercial es obligatorio.' };
    }
    if (trimmed.length < 3) {
      return { isValid: false, message: 'El nombre debe tener al menos 3 caracteres.' };
    }
    if (trimmed.length > 60) {
      return { isValid: false, message: 'El nombre no debe superar los 60 caracteres.' };
    }
    return { isValid: true };
  }, [name]);

  // Real-time Address validation
  const addressValidation = useMemo(() => {
    const trimmed = address.trim();
    if (!trimmed) {
      return { isValid: false, message: 'La dirección exacta es obligatoria.' };
    }
    if (trimmed.length < 5) {
      return { isValid: false, message: 'Especifica al menos calle, número y entrecalles (mínimo 5 caracteres).' };
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
        message: 'Has indicado que aceptas transferencia. Selecciona al menos una vía (Transfermóvil, EnZona, QR o En Línea).' 
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
      return { isValid: false, message: 'Teléfono fijo o adicional inválido (debe tener entre 6 y 10 dígitos).' };
    }
    return { isValid: true };
  }, [phone]);

  // Form Overall Validity
  const isFormValid = nameValidation.isValid && 
                       addressValidation.isValid && 
                       waValidation.isValid && 
                       paymentValidation.isValid && 
                       phoneValidation.isValid;

  if (!isOpen) return null;

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

  const handleApplyPresetWhatsApp = () => {
    setWhatsapp('+53 5284 9102');
    markTouched('whatsapp');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowAllErrors(true);

    if (!isFormValid) {
      // Find first error element and scroll/focus
      return;
    }

    // Use current pin location or fallback to province center
    const lat = pinLocation ? pinLocation.lat : currentProvinceData.center[0] + (Math.random() - 0.5) * 0.01;
    const lng = pinLocation ? pinLocation.lng : currentProvinceData.center[1] + (Math.random() - 0.5) * 0.01;

    onSubmit({
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
      photos: [selectedPhotoPreset],
      featured: false
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-600 text-white text-xs">
                <Store className="w-4 h-4" />
              </span>
              <h2 className="text-lg font-bold">Registrar Negocio en TransferCuba</h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Envía tu negocio para revisión. Un administrador lo aprobará para publicarlo en el mapa.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} noValidate className="flex-1 overflow-y-auto p-5 space-y-5">
          
          {/* Section 1: Business Info */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                1. Datos del Negocio
              </h3>
              <span className="text-[11px] text-slate-400">
                * Campos obligatorios
              </span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Commercial Name */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Nombre comercial *
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
                    placeholder="ej. Café & Market Habana"
                    className={`w-full text-sm px-3 py-2 pr-9 rounded-xl border transition-all ${
                      (touched.name || showAllErrors) && !nameValidation.isValid
                        ? 'border-rose-400 focus:ring-2 focus:ring-rose-400/30 bg-rose-50/20'
                        : touched.name && nameValidation.isValid
                        ? 'border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 bg-emerald-50/10'
                        : 'border-slate-200 focus:ring-2 focus:ring-emerald-500'
                    }`}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    {touched.name && nameValidation.isValid && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 animate-in zoom-in-50" />
                    )}
                    {(touched.name || showAllErrors) && !nameValidation.isValid && (
                      <AlertCircle className="w-4 h-4 text-rose-500 animate-in zoom-in-50" />
                    )}
                  </div>
                </div>
                {(touched.name || showAllErrors) && !nameValidation.isValid && (
                  <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    <span>{nameValidation.message}</span>
                  </p>
                )}
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Categoría principal
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
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
                <label className="text-xs font-semibold text-slate-700">
                  Breve descripción de productos o servicios
                </label>
                <span className="text-[10px] text-slate-400 font-mono">
                  {description.length}/200
                </span>
              </div>
              <textarea
                value={description}
                maxLength={200}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="ej. Pan recién salido del horno, pizzas, refrescos fríos y pagos directos por QR..."
                rows={2}
                className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Section 2: Location details */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              2. Ubicación Exacta en Cuba
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Provincia</label>
                <select
                  value={province}
                  onChange={(e) => handleProvinceChange(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  {CUBAN_PROVINCES.map(p => (
                    <option key={p.name} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Municipio</label>
                <select
                  value={municipality}
                  onChange={(e) => setMunicipality(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Dirección textual (Calle y números) *
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
                    placeholder="ej. Calle 23 #456 e/ J e I"
                    className={`w-full text-sm px-3 py-2 pr-9 rounded-xl border transition-all ${
                      (touched.address || showAllErrors) && !addressValidation.isValid
                        ? 'border-rose-400 focus:ring-2 focus:ring-rose-400/30 bg-rose-50/20'
                        : touched.address && addressValidation.isValid
                        ? 'border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 bg-emerald-50/10'
                        : 'border-slate-200 focus:ring-2 focus:ring-emerald-500'
                    }`}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    {touched.address && addressValidation.isValid && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 animate-in zoom-in-50" />
                    )}
                    {(touched.address || showAllErrors) && !addressValidation.isValid && (
                      <AlertCircle className="w-4 h-4 text-rose-500 animate-in zoom-in-50" />
                    )}
                  </div>
                </div>
                {(touched.address || showAllErrors) && !addressValidation.isValid && (
                  <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    <span>{addressValidation.message}</span>
                  </p>
                )}
              </div>

              {/* Neighborhood */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reparto o Zona (opcional)
                </label>
                <input
                  type="text"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  placeholder="ej. Vedado / Miramar / Santos Suárez"
                  className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Asistente Nominatim OpenStreetMap (Opción B del usuario) */}
            <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-blue-600" />
                  <span>Asistente de Calles con Nominatim OSM</span>
                </span>
                <span className="text-[10px] text-slate-400 font-semibold">OpenStreetMap Cuba</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Escribe la dirección para obtener automáticamente las coordenadas geográficas de Cuba:
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nominatimQuery}
                  onChange={(e) => setNominatimQuery(e.target.value)}
                  placeholder={address.trim() ? address : 'ej. Calle 23 e/ L y M, Vedado'}
                  className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1 transition-colors flex-shrink-0"
                >
                  <SearchIcon className="w-3 h-3" />
                  <span>{isSearchingNominatim ? 'Buscando...' : 'Buscar OSM'}</span>
                </button>
              </div>

              {nominatimResults.length > 0 && (
                <div className="p-2 bg-white rounded-lg border border-blue-200 space-y-1 max-h-36 overflow-y-auto">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Selecciona para fijar el pin:</p>
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
                      className="w-full text-left p-1.5 hover:bg-blue-50 rounded text-[11px] text-slate-700 border-b border-slate-100 last:border-0 flex items-start gap-1.5 transition-colors"
                    >
                      <MapPin className="w-3 h-3 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{item.display_name}</span>
                    </button>
                  ))}
                </div>
              )}
              {nominatimSearched && nominatimResults.length === 0 && !isSearchingNominatim && (
                <p className="text-[11px] text-slate-500 italic">
                  No se encontraron calles exactas en OSM con ese texto. Usa el botón verde para colocar el punto en el mapa.
                </p>
              )}
            </div>

            {/* Visual Map Pin Placement */}
            <div className={`p-3 rounded-xl border transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
              pinLocation 
                ? 'bg-emerald-50/60 border-emerald-200' 
                : 'bg-blue-50 border-blue-200'
            }`}>
              <div className="flex items-start gap-2.5">
                <MapPin className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                  pinLocation ? 'text-emerald-600' : 'text-blue-600'
                }`} />
                <div>
                  <div className="flex items-center gap-2">
                    <p className={`text-xs font-bold ${pinLocation ? 'text-emerald-950' : 'text-blue-950'}`}>
                      {pinLocation ? '✓ Punto exacto fijado en el mapa' : '📍 Colocar ubicación visualmente en el mapa'}
                    </p>
                    {pinLocation && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-[10px] text-white font-bold">
                        Confirmado
                      </span>
                    )}
                  </div>
                  <p className={`text-[11px] mt-0.5 ${pinLocation ? 'text-emerald-700 font-mono' : 'text-blue-700'}`}>
                    {pinLocation 
                      ? `Lat: ${pinLocation.lat.toFixed(5)}, Lng: ${pinLocation.lng.toFixed(5)}` 
                      : `Si no marcas el punto, se posicionará en el centro de ${municipality}.`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onStartPinning}
                className={`w-full sm:w-auto px-3.5 py-1.5 rounded-lg text-white text-xs font-semibold shadow-sm flex items-center justify-center gap-1.5 flex-shrink-0 transition-colors ${
                  pinLocation ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>{pinLocation ? 'Modificar punto' : 'Marcar en el mapa'}</span>
              </button>
            </div>
          </div>

          {/* Section 3: Payment Methods */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                3. Métodos de Pago Aceptados
              </h3>
              <button
                type="button"
                onClick={() => setAcceptsTransfer(!acceptsTransfer)}
                className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md transition-colors ${
                  acceptsTransfer 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" /> 
                {acceptsTransfer ? 'Acepta transferencias' : 'Solo efectivo'}
              </button>
            </div>

            {acceptsTransfer && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <label className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  transfermovil ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200 hover:bg-slate-50'
                }`}>
                  <input
                    type="checkbox"
                    checked={transfermovil}
                    onChange={(e) => {
                      setTransfermovil(e.target.checked);
                      markTouched('payments');
                    }}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-semibold text-slate-800">Transfermóvil</span>
                </label>

                <label className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  enzona ? 'border-blue-300 bg-blue-50/50' : 'border-slate-200 hover:bg-slate-50'
                }`}>
                  <input
                    type="checkbox"
                    checked={enzona}
                    onChange={(e) => {
                      setEnzona(e.target.checked);
                      markTouched('payments');
                    }}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-semibold text-slate-800">EnZona</span>
                </label>

                <label className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  qrPayment ? 'border-indigo-300 bg-indigo-50/50' : 'border-slate-200 hover:bg-slate-50'
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
                  <span className="font-semibold text-slate-800">Código QR en Caja</span>
                </label>

                <label className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  onlineGateway ? 'border-purple-300 bg-purple-50/50' : 'border-slate-200 hover:bg-slate-50'
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
                  <span className="font-semibold text-slate-800">Pago en línea</span>
                </label>

                <label className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  cash ? 'border-slate-300 bg-slate-100/50' : 'border-slate-200 hover:bg-slate-50'
                }`}>
                  <input
                    type="checkbox"
                    checked={cash}
                    onChange={(e) => setCash(e.target.checked)}
                    className="rounded text-slate-600 focus:ring-slate-500"
                  />
                  <span className="font-semibold text-slate-800">Efectivo CUP</span>
                </label>
              </div>
            )}

            {/* Error if acceptsTransfer is true but no gateway is checked */}
            {(touched.payments || showAllErrors) && !paymentValidation.isValid && (
              <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1 font-medium bg-rose-50 p-2 rounded-lg border border-rose-200">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-rose-600" />
                <span>{paymentValidation.message}</span>
              </p>
            )}

            {/* Real-time transfer status at moment of opening */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-slate-800">
                  ¿Están recibiendo transferencia en este momento?
                </p>
                <p className="text-[11px] text-slate-500">
                  Puedes cambiarlo cuando ocurran cortes eléctricos o caídas de red.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTransferActiveNow(true)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    transferActiveNow
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  🟢 Sí, activa
                </button>
                <button
                  type="button"
                  onClick={() => setTransferActiveNow(false)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    !transferActiveNow
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  🟡 No ahora
                </button>
              </div>
            </div>
          </div>

          {/* Section 4: Contact and WhatsApp Validation (HIGHLIGHT FEATURE) */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                4. Contacto Directo & WhatsApp
              </h3>
              <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                <MessageCircle className="w-3.5 h-3.5" /> Enlace directo para clientes
              </span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* WHATSAPP INPUT WITH REAL-TIME VALIDATION */}
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <span>Número de WhatsApp</span>
                    <span className="text-rose-500">*</span>
                    <span className="text-[11px] font-normal text-slate-400">
                      (Móvil cubano: 8 dígitos iniciando con 5)
                    </span>
                  </label>
                  
                  {/* Quick Preset / Demo Button */}
                  <button
                    type="button"
                    onClick={handleApplyPresetWhatsApp}
                    className="text-[11px] text-emerald-600 hover:text-emerald-800 font-semibold underline underline-offset-2 flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Rellenar ejemplo (+53 5284 9102)</span>
                  </button>
                </div>

                {/* Input with prefix badge */}
                <div className="relative flex rounded-xl shadow-sm">
                  <div className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-slate-200 bg-slate-50 text-slate-700 text-xs font-bold gap-1.5 select-none flex-shrink-0">
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
                    className={`flex-1 min-w-0 text-sm px-3 py-2.5 pr-10 rounded-r-xl border transition-all font-mono ${
                      (touched.whatsapp || showAllErrors) && !waValidation.isValid
                        ? 'border-rose-400 focus:ring-2 focus:ring-rose-400/30 bg-rose-50/20'
                        : touched.whatsapp && waValidation.isValid
                        ? 'border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 bg-emerald-50/10 text-emerald-950 font-bold'
                        : 'border-slate-200 focus:ring-2 focus:ring-emerald-500'
                    }`}
                  />

                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {touched.whatsapp && waValidation.isValid && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 animate-in zoom-in-50" />
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
                    <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-700 flex items-start gap-1.5 animate-in fade-in duration-150">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-semibold">{waValidation.errorMessage}</p>
                        <p className="text-[10px] text-rose-600 mt-0.5">
                          Ejemplo válido: <span className="font-mono font-bold">+53 5284 9102</span> o simplemente <span className="font-mono font-bold">52849102</span>
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Valid state: green preview with WhatsApp link */}
                  {waValidation.isValid && (
                    <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 flex items-center justify-between gap-2 animate-in fade-in duration-150">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <span>
                          Formato válido: <strong className="font-mono">{waValidation.formatted}</strong>
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
                          <span>Probar wa.me</span>
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
                      <span>Aplicar formato limpio internacional: {waValidation.formatted}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Optional Phone */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>Teléfono fijo alternativo (opcional)</span>
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
                  className={`w-full text-sm px-3 py-2 rounded-xl border transition-all ${
                    touched.phone && !phoneValidation.isValid
                      ? 'border-rose-400 bg-rose-50/20'
                      : 'border-slate-200 focus:ring-2 focus:ring-emerald-500'
                  }`}
                />
                {touched.phone && !phoneValidation.isValid && (
                  <p className="text-[11px] text-rose-600 mt-1">{phoneValidation.message}</p>
                )}
              </div>

              {/* Business Hours */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>Horario de atención</span>
                  </label>
                </div>
                <input
                  type="text"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder="08:00 — 20:00 (Lunes a Sábado)"
                  className="w-full text-sm px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Photo selection */}
          <div className="space-y-2 pt-3 border-t border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              5. Foto de Portada
            </h3>
            <p className="text-xs text-slate-500">Selecciona una imagen representativa para la ficha del local:</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { url: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=600&q=80', label: 'Tienda & Market' },
                { url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80', label: 'Pizzería / Comida' },
                { url: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=600&q=80', label: 'Cafetería & Bar' }
              ].map((img, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedPhotoPreset(img.url)}
                  className={`relative cursor-pointer rounded-xl overflow-hidden h-20 border-2 transition-all group ${
                    selectedPhotoPreset === img.url 
                      ? 'border-emerald-500 ring-2 ring-emerald-400/40 shadow-sm' 
                      : 'border-slate-200 opacity-75 hover:opacity-100'
                  }`}
                >
                  <Image 
                    src={img.url} 
                    alt={img.label} 
                    fill 
                    className="object-cover" 
                    referrerPolicy="no-referrer"
                    sizes="180px"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
                  <span className="absolute bottom-1.5 left-1.5 text-[11px] font-bold text-white drop-shadow-sm">
                    {img.label}
                  </span>
                  {selectedPhotoPreset === img.url && (
                    <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                      <Check className="w-2.5 h-2.5" />
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Validation summary banner if submit attempted with errors */}
          {showAllErrors && !isFormValid && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1 animate-in fade-in">
              <p className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                Por favor, corrige los siguientes campos antes de publicar:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-rose-700 pl-1 text-[11px]">
                {!nameValidation.isValid && <li>Nombre comercial: {nameValidation.message}</li>}
                {!addressValidation.isValid && <li>Dirección: {addressValidation.message}</li>}
                {!waValidation.isValid && <li>WhatsApp: {waValidation.errorMessage}</li>}
                {!paymentValidation.isValid && <li>Métodos de pago: {paymentValidation.message}</li>}
                {!phoneValidation.isValid && <li>Teléfono: {phoneValidation.message}</li>}
              </ul>
            </div>
          )}

          {/* Submit CTA with Moderation Notice */}
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
              <span className="text-base leading-none">🛡️</span>
              <p className="leading-relaxed">
                <strong>Aprobación de administrador:</strong> Tu negocio se guardará en estado <strong>Pendiente</strong>. Una vez revisado y aprobado por el administrador, aparecerá automáticamente en el mapa público y en las búsquedas.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-500 hidden sm:block">
                {isFormValid ? (
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Formulario listo para enviar
                  </span>
                ) : (
                  <span className="text-slate-400">
                    Revisa que los campos requeridos tengan formato correcto
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  id="btn-submit-biz"
                  className={`px-6 py-2.5 rounded-xl text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 w-full sm:w-auto ${
                    isFormValid 
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20 hover:shadow-lg' 
                      : 'bg-emerald-600 hover:bg-emerald-700 opacity-90'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>Enviar para Aprobación</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
