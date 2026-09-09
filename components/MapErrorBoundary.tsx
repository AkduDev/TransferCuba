'use client';

import React from 'react';
import { RotateCw, RefreshCw, AlertCircle } from 'lucide-react';

interface MapErrorBoundaryProps {
  children: React.ReactNode;
}

interface MapErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export default class MapErrorBoundary extends React.Component<
  MapErrorBoundaryProps,
  MapErrorBoundaryState
> {
  constructor(props: MapErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): MapErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[MapErrorBoundary caught error]:', error, errorInfo);

    // Auto-reload once if it's a ChunkLoadError (common after incremental build updates)
    const isChunkError =
      error?.name === 'ChunkLoadError' ||
      error?.message?.includes('Loading chunk') ||
      error?.message?.includes('ChunkLoadError');

    if (isChunkError && typeof window !== 'undefined') {
      const now = Date.now();
      const lastReload = sessionStorage.getItem('dondepago_chunk_autoreload');
      if (!lastReload || now - parseInt(lastReload, 10) > 15000) {
        sessionStorage.setItem('dondepago_chunk_autoreload', now.toString());
        console.warn('Auto-reloading page to fetch latest compiled chunk...');
        window.location.reload();
      }
    }
  }

  handleReload = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('dondepago_chunk_autoreload');
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 p-6 text-center z-10 relative">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mb-3 shadow-inner">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-sm sm:text-base font-bold text-slate-800">
            Actualización de componentes del mapa
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4 leading-relaxed">
            El servidor ha recompilado los módulos interactivos con los cambios más recientes. Haz clic para refrescar el visor de mapas.
          </p>
          <button
            onClick={this.handleReload}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all"
          >
            <RotateCw className="w-4 h-4" />
            <span>Refrescar mapa</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
