'use client';

import React, { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import { Business } from '@/lib/cuba-data';

interface MapLibreMapProps {
  businesses: Business[];
  selectedBusiness: Business | null;
  onSelectBusiness: (business: Business) => void;
  center: [number, number]; // [lat, lng]
  zoom: number;
  userLocation: { lat: number; lng: number } | null;
  isPinningMode?: boolean;
  pinLocation?: { lat: number; lng: number } | null;
  onPinLocationChange?: (coords: { lat: number; lng: number }) => void;
  onMapClick?: (coords: { lat: number; lng: number }) => void;
  routeGeometry?: { type: 'LineString'; coordinates: [number, number][] } | null;
}

// Vector basemap — OpenFreeMap Positron (free, unlimited, no API key).
// Rendered on GPU: crisp at any zoom, ~70% fewer requests than raster tiles.
const BASEMAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';

function markerVisualState(biz: Business): {
  badgeColor: string;
  isVerified: boolean;
  isReported: boolean;
} {
  const isReported = biz.reportsCount > 0;
  const isVerified = biz.transferVerified && !isReported;
  const badgeColor = isReported ? '#e11d48' : isVerified ? '#10b981' : '#f59e0b';
  return { badgeColor, isVerified, isReported };
}

function buildMarkerElement(biz: Business, isSelected: boolean): HTMLElement {
  const { badgeColor, isVerified, isReported } = markerVisualState(biz);

  const el = document.createElement('div');
  el.className =
    'transfercuba-marker-container cursor-pointer transition-transform duration-200 hover:scale-110';
  el.style.zIndex = isSelected ? '100' : '10';

  el.innerHTML = `
    <div class="relative flex flex-col items-center group">
      ${biz.transferActiveNow
        ? `
        <span class="absolute -top-1 -right-1 flex h-3 w-3">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border border-white"></span>
        </span>
      `
        : ''}

      <div style="background-color: ${isSelected ? '#0f2942' : badgeColor}; box-shadow: 0 4px 10px rgba(15, 41, 66, 0.28);"
           class="w-9 h-9 rounded-xl border-2 border-white flex items-center justify-center text-white text-base transition-all ${isSelected ? 'ring-4 ring-cerulean/40 scale-110' : ''}">
        <span>${biz.categoryIcon}</span>
      </div>

      <div style="background-color: ${isSelected ? '#0f2942' : badgeColor};"
           class="w-2.5 h-2.5 rotate-45 -mt-1"></div>

      <div class="absolute -bottom-1 px-1.5 rounded-full text-[9px] font-black uppercase text-white shadow-sm"
           style="background-color: ${badgeColor};">
        ${isVerified ? '✓' : isReported ? '⚠' : '⏳'}
      </div>
    </div>
  `;

  return el;
}

export default function MapLibreMap({
  businesses,
  selectedBusiness,
  onSelectBusiness,
  center,
  zoom,
  userLocation,
  isPinningMode = false,
  pinLocation,
  onPinLocationChange,
  onMapClick,
  routeGeometry
}: MapLibreMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const markersByIdRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const pinMarkerRef = useRef<maplibregl.Marker | null>(null);
  const lastViewRef = useRef<{ lat: number; lng: number; zoom: number } | null>(null);

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

  // Initialize MapLibre GL instance
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;
    const markersById = markersByIdRef.current;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      // Vector style: glyphs + sprites resolved from the style itself.
      style: BASEMAP_STYLE,
      center: [centerLng, centerLat], // MapLibre uses [lng, lat]
      zoom: zoom,
      attributionControl: false,
      // Instant tile swap on zoom — no crossfade lag on slow connections.
      fadeDuration: 0,
      // Keep a large browser-side tile cache for fluid pan/zoom.
      maxTileCacheSize: 400,
      transformRequest: (url: string) => {
        return { url };
      }
    });

    // Gracefully handle benign tile loading cancellations or network aborts
    map.on('error', (e) => {
      const err = e?.error;
      const status = (err as unknown as { status?: number })?.status;
      if (
        !err ||
        status === 0 ||
        (err?.message && (
          err.message.includes('Failed to fetch') ||
          err.message.includes('AJAXError') ||
          err.message.includes('aborted')
        ))
      ) {
        // Benign tile load cancellation (e.g. while rapidly panning or zooming)
        return;
      }
      console.warn('MapLibre map notification:', e);
    });

    // Add navigation controls (zoom in/out, compass)
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');
    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution:
          '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> © OpenMapTiles · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OSM</a>'
      }),
      'bottom-left'
    );

    mapInstanceRef.current = map;
    lastViewRef.current = { lat: centerLat, lng: centerLng, zoom };

    // Container ResizeObserver for seamless responsiveness
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const resizeObserver = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.resize();
        }
      }, 100);
    });

    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    // Map click handler
    map.on('click', (e) => {
      const current = callbacksRef.current;
      if (current.isPinningMode && current.onPinLocationChange) {
        current.onPinLocationChange({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      } else if (current.onMapClick) {
        current.onMapClick({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      }
    });

    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeObserver.disconnect();
      markersById.clear();
      map.remove();
      mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync center and zoom — only animate when the target is meaningfully
  // different from the current view (avoids redundant flyTo animations).
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const last = lastViewRef.current;
    const movedEnough =
      !last ||
      Math.abs(last.lat - centerLat) > 0.0005 ||
      Math.abs(last.lng - centerLng) > 0.0005 ||
      Math.abs(last.zoom - zoom) > 0.05;

    if (!movedEnough) return;

    lastViewRef.current = { lat: centerLat, lng: centerLng, zoom };
    map.flyTo({
      center: [centerLng, centerLat],
      zoom: zoom,
      essential: true,
      duration: 1200
    });
  }, [centerLat, centerLng, zoom]);

  // Render business markers — reconciled by id: only added/removed/updated
  // markers touch the DOM instead of rebuilding every marker on each change.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const markersById = markersByIdRef.current;
    const nextIds = new Set(businesses.map((b) => b.id));

    // Remove markers no longer present
    for (const [id, marker] of markersById) {
      if (!nextIds.has(id)) {
        marker.remove();
        markersById.delete(id);
      }
    }

    businesses.forEach((biz) => {
      const isSelected = selectedBusiness?.id === biz.id;
      const existing = markersById.get(biz.id);

      if (existing) {
        // Update position in case coords changed
        existing.setLngLat([biz.lng, biz.lat]);
        // Update selection visuals only when selection changed for this marker
        const el = existing.getElement();
        const wasSelected = el.dataset.selected === 'true';
        if (wasSelected !== isSelected) {
          const fresh = buildMarkerElement(biz, isSelected);
          fresh.dataset.selected = String(isSelected);
          fresh.addEventListener('click', (e) => {
            e.stopPropagation();
            onSelectBusiness(biz);
          });
          // MapLibre keeps an internal reference to the original element:
          // rebuild the marker wrapper preserving coordinates.
          const replacement = new maplibregl.Marker({ element: fresh })
            .setLngLat(existing.getLngLat())
            .addTo(map);
          existing.remove();
          markersById.set(biz.id, replacement);
        }
        return;
      }

      // New marker
      const el = buildMarkerElement(biz, isSelected);
      el.dataset.selected = String(isSelected);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelectBusiness(biz);
      });
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([biz.lng, biz.lat])
        .addTo(map);
      markersById.set(biz.id, marker);
    });
  }, [businesses, selectedBusiness, onSelectBusiness]);

  // Render User Location GPS Marker
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    if (userLocation) {
      const el = document.createElement('div');
      el.className = 'transfercuba-user-location';
      el.innerHTML = `
        <div class="relative flex items-center justify-center">
          <span class="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-cerulean/60 opacity-70"></span>
          <div class="w-5 h-5 rounded-full bg-cerulean border-2 border-white shadow-lg flex items-center justify-center text-white text-[10px] font-bold">
            📍
          </div>
        </div>
      `;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(map);

      userMarkerRef.current = marker;
    }
  }, [userLocation]);

  // Handle Pinning Mode (Registration Pin)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (pinMarkerRef.current) {
      pinMarkerRef.current.remove();
      pinMarkerRef.current = null;
    }

    if (isPinningMode && pinLocation) {
      const el = document.createElement('div');
      el.className = 'transfercuba-pin-marker cursor-grab active:cursor-grabbing';
      el.innerHTML = `
        <div class="flex flex-col items-center animate-bounce">
          <div class="px-2.5 py-1 bg-navy text-white text-[11px] font-bold rounded-lg shadow-level-3 border border-navy-hover whitespace-nowrap mb-1">
            📍 Arrastra hasta la puerta
          </div>
          <div class="w-8 h-8 rounded-full bg-emerald-brand text-white border-2 border-white shadow-level-4 flex items-center justify-center font-bold">
            ✓
          </div>
          <div class="w-2 h-2 bg-emerald-brand/80 rotate-45 -mt-1"></div>
        </div>
      `;

      const marker = new maplibregl.Marker({ element: el, draggable: true })
        .setLngLat([pinLocation.lng, pinLocation.lat])
        .addTo(map);

      marker.on('dragend', () => {
        const lngLat = marker.getLngLat();
        if (onPinLocationChange) {
          onPinLocationChange({ lat: lngLat.lat, lng: lngLat.lng });
        }
      });

      pinMarkerRef.current = marker;
    }
  }, [isPinningMode, pinLocation, onPinLocationChange]);

  // Render OSRM Route Layer
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    const sourceId = 'osrm-route-source';
    const layerId = 'osrm-route-layer';

    const updateRouteLayer = () => {
      // Remove existing route layer & source
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }

      if (routeGeometry) {
        map.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: routeGeometry
          }
        });

        map.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#0284c7',
            'line-width': 5,
            'line-opacity': 0.85
          }
        });

        // Fit bounds to route
        const coords = routeGeometry.coordinates;
        if (coords.length > 0) {
          const bounds = coords.reduce(
            (b, coord) => b.extend(coord as [number, number]),
            new maplibregl.LngLatBounds(coords[0], coords[0])
          );
          map.fitBounds(bounds, { padding: 60, maxZoom: 16 });
        }
      }
    };

    if (map.isStyleLoaded()) {
      updateRouteLayer();
    } else {
      map.once('style.load', updateRouteLayer);
    }
  }, [routeGeometry]);

  return (
    <div className="relative w-full h-full bg-canvas overflow-hidden">
      <div id="maplibre-map-canvas" ref={mapContainerRef} className="w-full h-full z-0" />

      {isPinningMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-navy/95 text-white backdrop-blur-md px-4 py-2 rounded-lg text-xs sm:text-sm font-medium shadow-level-3 border border-navy-hover flex items-center gap-2 pointer-events-none animate-pulse">
          <span>📍 Haz clic en el mapa o arrastra el marcador verde hasta tu local</span>
        </div>
      )}
    </div>
  );
}
