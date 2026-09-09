'use client';

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Business } from '@/lib/cuba-data';

interface InteractiveMapProps {
  businesses: Business[];
  selectedBusiness: Business | null;
  onSelectBusiness: (business: Business) => void;
  center: [number, number];
  zoom: number;
  userLocation: { lat: number; lng: number } | null;
  isPinningMode?: boolean;
  pinLocation?: { lat: number; lng: number } | null;
  onPinLocationChange?: (coords: { lat: number; lng: number }) => void;
  onMapClick?: (coords: { lat: number; lng: number }) => void;
}

export default function InteractiveMap({
  businesses,
  selectedBusiness,
  onSelectBusiness,
  center,
  zoom,
  userLocation,
  isPinningMode = false,
  pinLocation,
  onPinLocationChange,
  onMapClick
}: InteractiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const pinMarkerRef = useRef<L.Marker | null>(null);

  const centerLat = center[0];
  const centerLng = center[1];

  const callbacksRef = useRef({
    isPinningMode,
    onPinLocationChange,
    onMapClick
  });

  useEffect(() => {
    callbacksRef.current = {
      isPinningMode,
      onPinLocationChange,
      onMapClick
    };
  }, [isPinningMode, onPinLocationChange, onMapClick]);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Create map instance
    const map = L.map(mapContainerRef.current, {
      center: [centerLat, centerLng],
      zoom,
      zoomControl: false,
      attributionControl: false
    });

    // Add CartoDB Positron / OSM tiles for crisp, clean, neutral rendering
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }).addTo(map);

    // Zoom controls at bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Attribution at bottom left
    L.control.attribution({ position: 'bottomleft', prefix: 'OpenStreetMap | DevParadise' }).addTo(map);

    // Markers layer
    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;
    mapInstanceRef.current = map;

    // Responsive container ResizeObserver to keep tiles rendered properly
    let resizeTimer: NodeJS.Timeout | null = null;
    const resizeObserver = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize({ animate: false });
        }
      }, 100);
    });

    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    // Handle clicks
    map.on('click', (e: L.LeafletMouseEvent) => {
      const current = callbacksRef.current;
      if (current.isPinningMode && current.onPinLocationChange) {
        current.onPinLocationChange({ lat: e.latlng.lat, lng: e.latlng.lng });
      } else if (current.onMapClick) {
        current.onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    });

    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync center and zoom
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setView([centerLat, centerLng], zoom, { animate: true, duration: 0.8 });
  }, [centerLat, centerLng, zoom]);


  // Handle map click mode updates
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    const clickHandler = (e: L.LeafletMouseEvent) => {
      if (isPinningMode && onPinLocationChange) {
        onPinLocationChange({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    };

    map.off('click');
    map.on('click', clickHandler);

    return () => {
      map.off('click', clickHandler);
    };
  }, [isPinningMode, onPinLocationChange]);

  // Render Business markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;
    const layer = markersLayerRef.current;
    layer.clearLayers();

    businesses.forEach((biz) => {
      const isSelected = selectedBusiness?.id === biz.id;
      const isTransferActive = biz.transferActiveNow;

      // Color mapping
      let categoryColor = '#2563eb'; // blue
      let categoryIconSvg = '🏪';
      if (biz.category === 'comida') {
        categoryColor = '#10b981'; // emerald
        categoryIconSvg = '🍕';
      } else if (biz.category === 'tiendas') {
        categoryColor = '#0284c7'; // sky
        categoryIconSvg = '🛒';
      } else if (biz.category === 'farmacias') {
        categoryColor = '#8b5cf6'; // purple
        categoryIconSvg = '💊';
      } else if (biz.category === 'servicios') {
        categoryColor = '#f59e0b'; // amber
        categoryIconSvg = '📱';
      } else if (biz.category === 'cafeterias') {
        categoryColor = '#d97706'; // warm amber
        categoryIconSvg = '☕';
      } else if (biz.category === 'ferreteria') {
        categoryColor = '#64748b'; // slate
        categoryIconSvg = '🔧';
      }

      const markerHtml = `
        <div class="relative group cursor-pointer transition-all duration-200 ${isSelected ? 'scale-125 z-50' : 'hover:scale-110 z-20'}">
          <!-- Pin Body -->
          <div class="w-11 h-11 rounded-2xl flex items-center justify-center shadow-xl transition-all ${
            isSelected
              ? 'bg-slate-950 text-white ring-4 ring-emerald-500/50 shadow-emerald-950/40 border-2 border-emerald-400'
              : 'bg-white text-slate-900 border-2 border-slate-200/90 shadow-slate-900/20 group-hover:border-emerald-500'
          }">
            <span class="text-lg leading-none select-none">${categoryIconSvg}</span>
          </div>

          <!-- Teardrop stem point -->
          <div class="w-2.5 h-2.5 rotate-45 mx-auto -mt-1.5 transition-colors ${
            isSelected ? 'bg-emerald-500 ring-2 ring-emerald-400' : 'bg-white border-r-2 border-b-2 border-slate-200/90 group-hover:border-emerald-500'
          }"></div>

          <!-- Live Transfer Beacon / Status Pip -->
          <div class="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full border-2 border-white ${
            isTransferActive 
              ? 'bg-emerald-500 shadow-md shadow-emerald-500/60' 
              : 'bg-amber-500 shadow-md shadow-amber-500/40'
          }" title="${isTransferActive ? 'Transferencia activa ahora' : 'Transferencia no disponible hoy'}">
            ${isTransferActive ? '<span class="text-[8px] text-white font-extrabold leading-none">✓</span>' : '<span class="text-[8px] text-white font-black leading-none">!</span>'}
          </div>

          <!-- Verified DevParadise small indicator -->
          ${biz.transferVerified ? `
            <div class="absolute -bottom-1 -left-1 w-3.5 h-3.5 rounded-full bg-blue-600 border border-white flex items-center justify-center text-[7px] text-white font-black shadow-sm" title="Verificado DevParadise">
              ★
            </div>
          ` : ''}

          <!-- Micro tooltip popup on hover / selected -->
          <div class="pointer-events-none absolute left-1/2 -translate-x-1/2 top-12 whitespace-nowrap px-2.5 py-1 rounded-xl text-[11px] font-bold tracking-tight shadow-xl border backdrop-blur-md transition-all ${
            isSelected
              ? 'bg-slate-950 text-white border-slate-700 opacity-100'
              : 'bg-slate-900/95 text-white border-slate-800 opacity-0 group-hover:opacity-100'
          }">
            <div class="flex items-center gap-1.5">
              <span>${biz.name}</span>
              ${isTransferActive ? '<span class="text-emerald-400 text-[10px]">● Activo</span>' : '<span class="text-amber-400 text-[10px]">● Efectivo</span>'}
            </div>
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-biz-marker',
        html: markerHtml,
        iconSize: [44, 48],
        iconAnchor: [22, 44]
      });

      const marker = L.marker([biz.lat, biz.lng], { icon: customIcon });
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectBusiness(biz);
      });
      layer.addLayer(marker);
    });
  }, [businesses, selectedBusiness, onSelectBusiness]);

  // Handle User Location marker
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (userMarkerRef.current) {
      map.removeLayer(userMarkerRef.current);
      userMarkerRef.current = null;
    }

    if (userLocation) {
      const userHtml = `
        <div class="relative flex items-center justify-center">
          <div class="w-8 h-8 rounded-full bg-blue-500/30 animate-ping absolute"></div>
          <div class="w-5 h-5 rounded-full bg-blue-600 border-2 border-white shadow-md relative z-10 flex items-center justify-center">
            <div class="w-2 h-2 rounded-full bg-white"></div>
          </div>
        </div>
      `;

      const userIcon = L.divIcon({
        className: 'user-loc-marker',
        html: userHtml,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker([userLocation.lat, userLocation.lng], {
        icon: userIcon,
        zIndexOffset: 1000
      }).addTo(map);

      userMarkerRef.current = marker;
    }
  }, [userLocation]);

  // Handle Pinning Mode (registration modal)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (pinMarkerRef.current) {
      map.removeLayer(pinMarkerRef.current);
      pinMarkerRef.current = null;
    }

    if (isPinningMode && pinLocation) {
      const pinHtml = `
        <div class="relative flex flex-col items-center cursor-grab active:cursor-grabbing animate-bounce">
          <div class="px-2.5 py-1 bg-emerald-600 text-white text-xs font-bold rounded-lg shadow-lg border border-white whitespace-nowrap mb-1">
            📍 Coloca tu negocio aquí
          </div>
          <div class="w-8 h-8 rounded-full bg-emerald-500 text-white border-2 border-white shadow-xl flex items-center justify-center font-bold">
            ✓
          </div>
          <div class="w-2 h-2 bg-emerald-700 rotate-45 -mt-1"></div>
        </div>
      `;

      const pinIcon = L.divIcon({
        className: 'registration-pin-marker',
        html: pinHtml,
        iconSize: [160, 60],
        iconAnchor: [80, 58]
      });

      const marker = L.marker([pinLocation.lat, pinLocation.lng], {
        icon: pinIcon,
        draggable: true,
        zIndexOffset: 2000
      }).addTo(map);

      marker.on('dragend', (e) => {
        const target = e.target as L.Marker;
        const newPos = target.getLatLng();
        if (onPinLocationChange) {
          onPinLocationChange({ lat: newPos.lat, lng: newPos.lng });
        }
      });

      pinMarkerRef.current = marker;
    }
  }, [isPinningMode, pinLocation, onPinLocationChange]);

  return (
    <div className="relative w-full h-full bg-slate-100 overflow-hidden">
      <div id="leaflet-map-canvas" ref={mapContainerRef} className="w-full h-full z-0" />
      
      {isPinningMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-slate-900/90 text-white backdrop-blur-md px-4 py-2 rounded-xl text-xs sm:text-sm font-medium shadow-xl border border-slate-700/80 flex items-center gap-2 pointer-events-none animate-pulse">
          <span>📍 Haz clic en el mapa o arrastra el marcador verde hasta la puerta de tu negocio</span>
        </div>
      )}
    </div>
  );
}
