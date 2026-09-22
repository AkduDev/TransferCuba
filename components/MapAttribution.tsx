'use client';
export default function MapAttribution() {
  return (
    <div className="absolute bottom-2 left-2 z-10 hidden sm:flex items-center gap-1.5 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-md shadow-level-1 border border-border-subtle text-[10px] font-semibold text-text-muted pointer-events-none">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-brand animate-pulse" />
      <span>MapLibre GL JS · OpenStreetMap · OSRM</span>
    </div>
  );
}
