'use client';
import { Check } from 'lucide-react';

interface PinningControlsProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export default function PinningControls({ onConfirm, onCancel }: PinningControlsProps) {
  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-white p-3 rounded-xl shadow-level-4 border border-border-subtle animate-in slide-in-from-bottom-5">
      <button
        onClick={onConfirm}
        className="px-5 py-2.5 bg-emerald-brand hover:bg-emerald-600 text-white font-bold text-xs sm:text-sm rounded-lg shadow-level-1 flex items-center gap-2"
      >
        <Check className="w-4 h-4" />
        <span>Confirmar esta ubicación</span>
      </button>
      <button
        onClick={onCancel}
        className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs sm:text-sm rounded-lg"
      >
        Cancelar
      </button>
    </div>
  );
}
