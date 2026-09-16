import { useState, useRef, useEffect, useCallback } from 'react';
import type { Map as MaplibreMap } from 'maplibre-gl';

export interface MapViewportState {
  mapRef: React.MutableRefObject<MaplibreMap | null>;
  mapCenter: [number, number];
  mapZoom: number;
  viewportBbox: [number, number, number, number] | null;
  mapReady: boolean;
  isFullscreen: boolean;
  setMapCenter: (c: [number, number]) => void;
  setMapZoom: (z: number) => void;
  setViewportBbox: (b: [number, number, number, number] | null) => void;
  setMapReady: (r: boolean) => void;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleToggleFullscreen: () => void;
  centerOn: (lat: number, lng: number, zoom: number) => void;
}

export function useMapViewport(showToast: (msg: string) => void): MapViewportState {
  const mapRef = useRef<MaplibreMap | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([23.1385, -82.3842]);
  const [mapZoom, setMapZoom] = useState<number>(14);
  const [viewportBbox, setViewportBbox] = useState<[number, number, number, number] | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const handleZoomIn = useCallback(() => { mapRef.current?.zoomIn(); }, []);
  const handleZoomOut = useCallback(() => { mapRef.current?.zoomOut(); }, []);
  const handleToggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement
        .requestFullscreen()
        .catch(() => showToast('No se pudo activar la pantalla completa.'));
    }
  }, [showToast]);

  const centerOn = useCallback((lat: number, lng: number, zoom: number) => {
    setMapCenter([lat, lng]);
    setMapZoom(zoom);
  }, []);

  return {
    mapRef, mapCenter, setMapCenter, mapZoom, setMapZoom,
    viewportBbox, setViewportBbox, mapReady, setMapReady,
    isFullscreen, handleZoomIn, handleZoomOut, handleToggleFullscreen, centerOn
  };
}
