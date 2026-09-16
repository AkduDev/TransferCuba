'use client';
import { Sparkles } from 'lucide-react';

export default function GoogleMapsToast({ message }: { message: string }) {
  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-navy/95 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-lg shadow-level-3 border border-navy-hover flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-200 pointer-events-none">
      <Sparkles className="w-4 h-4 text-emerald-brand flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}
