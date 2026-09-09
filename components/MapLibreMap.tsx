'use client';

import React, { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, MapMouseEvent } from 'maplibre-gl';
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
  onViewportChange?: (bbox: [number, number, number, number], zoom: number) => void;
}

// Vector basemap — OpenFreeMap Positron (free, unlimited, no API key).
const BASEMAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';

const SOURCE_ID = 'businesses-source';
const LAYER_CLUSTER_ID = 'clusters-layer';
const LAYER_CLUSTER_COUNT_ID = 'cluster-count-layer';
const LAYER_UNCLUSTERED_ID = 'unclustered-layer';

// Pin badge colors (design system)
const COLOR_VERIFIED = '#10b981';
const COLOR_REPORTED = '#e11d48';
const COLOR_PENDING = '#f59e0b';
const COLOR_SELECTED = '#0f2942';

function statusColor(biz: Business): string {
  if (biz.reportsCount > 0) return COLOR_REPORTED;
  if (biz.transferVerified) return COLOR_VERIFIED;
  return COLOR_PENDING;
}

// Runtime-canvas pin icon: colored rounded pin with category emoji + status pip.
// Avoids shipping dozens of PNG assets; rendered once per (category,state) pair.
function makePinIcon(
  emoji: string,
  color: string,
  opts: { selected?: boolean; activeNow?: boolean } = {}
): HTMLCanvasElement {
  const scale = 2; // retina
  const size = 36 * scale;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size * 1.25;
  const ctx = canvas.getContext('2d')!;

  const cx = size / 2;
  const headR = 15 * scale;
  const headCy = headR + 2 * scale;
  const tailY = headCy + headR + 6 * scale;

  // Pin head (rounded square)
  const headSize = headR * 2;
  const headX = cx - headR;
  ctx.save();
  ctx.shadowColor = 'rgba(15, 41, 66, 0.30)';
  ctx.shadowBlur = 6 * scale;
  ctx.shadowOffsetY = 2 * scale;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(headX, headCy - headR, headSize, headSize, 9 * scale);
  ctx.fill();
  ctx.restore();

  // White border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.roundRect(headX, headCy - headR, headSize, headSize, 9 * scale);
  ctx.stroke();

  // Tail triangle
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx - 5 * scale, headCy + headR - 1 * scale);
  ctx.lineTo(cx + 5 * scale, headCy + headR - 1 * scale);
  ctx.lineTo(cx, tailY);
  ctx.closePath();
  ctx.fill();

  // Category emoji
  ctx.font = `${14 * scale}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, cx, headCy);

  // Status / selection pip
  const pipColor = opts.selected ? '#ffffff' : color;
  const pipBg = opts.selected ? COLOR_SELECTED : '#ffffff';
  ctx.beginPath();
  ctx.arc(cx + headR - 2 * scale, headCy - headR + 2 * scale, 5.5 * scale, 0, Math.PI * 2);
  ctx.fillStyle = pipBg;
  ctx.fill();
  ctx.lineWidth = 1.5 * scale;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  if (opts.selected) {
    ctx.font = `bold ${7 * scale}px sans-serif`;
    ctx.fillStyle = COLOR_SELECTED;
    ctx.fillText('✓', cx + headR - 2 * scale, headCy - headR + 2.5 * scale);
  } else {
    ctx.beginPath();
    ctx.arc(cx + headR - 2 * scale, headCy - headR + 2 * scale, 2 * scale, 0, Math.PI * 2);
    ctx.fillStyle = pipColor;
    ctx.fill();
  }

  // "Active now" beacon dot (top-left)
  if (opts.activeNow) {
    ctx.beginPath();
    ctx.arc(cx - headR + 2 * scale, headCy - headR + 2 * scale, 4 * scale, 0, Math.PI * 2);
    ctx.fillStyle = COLOR_VERIFIED;
    ctx.fill();
    ctx.lineWidth = 1.5 * scale;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  }

  return canvas;
}

function iconIdFor(biz: Business, selected: boolean): string {
  const state = selected ? 'sel' : statusColor(biz) === COLOR_VERIFIED ? 'v' : statusColor(biz) === COLOR_REPORTED ? 'r' : 'p';
  return `pin-${biz.categoryIcon}-${state}-${biz.transferActiveNow ? 'on' : 'off'}`;
}

function businessesToGeoJSON(businesses: Business[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: businesses.map((biz) => ({
      type: 'Feature' as const,
      id: biz.id,
      properties: {
        id: biz.id,
        name: biz.name,
        categoryIcon: biz.categoryIcon,
        status: biz.reportsCount > 0 ? 'reported' : biz.transferVerified ? 'verified' : 'pending',
        activeNow: biz.transferActiveNow,
        selected: false
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [biz.lng, biz.lat]
      }
    }))
  };
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
  routeGeometry,
  onViewportChange
}: MapLibreMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const pinMarkerRef = useRef<maplibregl.Marker | null>(null);
  const lastViewRef = useRef<{ lat: number; lng: number; zoom: number } | null>(null);
  const iconsCacheRef = useRef<Set<string>>(new Set());
  const businessesByIdRef = useRef<Map<string, Business>>(new Map());
  const selectionStateRef = useRef<string | null>(null);

  const centerLat = center[0];
  const centerLng = center[1];

  const callbacksRef = useRef({
    isPinningMode,
    onPinLocationChange,
    onMapClick,
    onViewportChange
  });

  useEffect(() => {
    callbacksRef.current = {
      isPinningMode,
      onPinLocationChange,
      onMapClick,
      onViewportChange
    };
  }, [isPinningMode, onPinLocationChange, onMapClick, onViewportChange]);

  // Initialize MapLibre GL instance
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;
    const iconsCache = iconsCacheRef.current;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: BASEMAP_STYLE,
      center: [centerLng, centerLat],
      zoom: zoom,
      attributionControl: false,
      fadeDuration: 0,
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
        return;
      }
      console.warn('MapLibre map notification:', e);
    });

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

    // Map click handler (pinning / generic clicks)
    map.on('click', (e: MapMouseEvent) => {
      const current = callbacksRef.current;
      if (current.isPinningMode && current.onPinLocationChange) {
        current.onPinLocationChange({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      } else if (current.onMapClick) {
        current.onMapClick({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      }
    });

    // Viewport change (debounced) — feeds Sprint 3 server queries
    let moveendTimer: ReturnType<typeof setTimeout> | null = null;
    map.on('moveend', () => {
      if (moveendTimer) clearTimeout(moveendTimer);
      moveendTimer = setTimeout(() => {
        const cb = callbacksRef.current.onViewportChange;
        if (!cb || !mapInstanceRef.current) return;
        const b = mapInstanceRef.current.getBounds();
        cb(
          [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
          mapInstanceRef.current.getZoom()
        );
      }, 250);
    });

    return () => {
      if (moveendTimer) clearTimeout(moveendTimer);
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeObserver.disconnect();
      iconsCache.clear();
      map.remove();
      mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync center and zoom — only when meaningfully different
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

  // Businesses GeoJSON layer — cluster + symbol pins (GPU rendered)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // index for click resolution
    businessesByIdRef.current = new Map(businesses.map((b) => [b.id, b]));

    const setupLayers = () => {
      // Register any new runtime icons for this batch of businesses
      businesses.forEach((biz) => {
        [false, true].forEach((sel) => {
          const id = iconIdFor(biz, sel);
          if (!map.hasImage(id) && !iconsCacheRef.current.has(id)) {
            iconsCacheRef.current.add(id);
            const img = new Image();
            img.src = makePinIcon(biz.categoryIcon, statusColor(biz), {
              selected: sel,
              activeNow: biz.transferActiveNow
            }).toDataURL('image/png');
            map.addImage(id, img);
          }
        });
      });

      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: 'geojson',
          data: businessesToGeoJSON(businesses),
          cluster: true,
          clusterRadius: 55,
          clusterMaxZoom: 14,
          clusterProperties: {
            active: ['+', ['case', ['get', 'activeNow'], 1, 0]]
          }
        });

        // Clusters: navy bubble with count
        map.addLayer({
          id: LAYER_CLUSTER_ID,
          type: 'circle',
          source: SOURCE_ID,
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': COLOR_SELECTED,
            'circle-radius': [
              'step',
              ['get', 'point_count'],
              16,
              10,
              20,
              25,
              24
            ],
            'circle-opacity': 0.92,
            'circle-stroke-width': 3,
            'circle-stroke-color': '#ffffff'
          }
        });

        map.addLayer({
          id: LAYER_CLUSTER_COUNT_ID,
          type: 'symbol',
          source: SOURCE_ID,
          filter: ['has', 'point_count'],
          layout: {
            'text-field': ['get', 'point_count_abbreviated'],
            'text-font': ['Noto Sans Regular'],
            'text-size': 12
          },
          paint: {
            'text-color': '#ffffff'
          }
        });

        // Individual pins: runtime icon by state, selection via feature-state
        map.addLayer({
          id: LAYER_UNCLUSTERED_ID,
          type: 'symbol',
          source: SOURCE_ID,
          filter: ['!', ['has', 'point_count']],
          layout: {
            'icon-image': [
              'case',
              ['boolean', ['feature-state', 'selected'], false],
              ['concat', 'pin-', ['get', 'categoryIcon'], '-sel-', ['case', ['get', 'activeNow'], 'on', 'off']],
              ['concat', 'pin-', ['get', 'categoryIcon'], '-', ['get', 'status'], '-', ['case', ['get', 'activeNow'], 'on', 'off']]
            ],
            'icon-allow-overlap': false,
            'icon-ignore-placement': true,
            'icon-anchor': 'bottom',
            'icon-padding': 4
          }
        });

        // Cluster click → zoom into cluster
        map.on('click', LAYER_CLUSTER_ID, (e) => {
          const feature = e.features?.[0];
          if (!feature) return;
          const clusterId = feature.properties?.cluster_id;
          const src = map.getSource(SOURCE_ID) as GeoJSONSource;
          src
            .getClusterExpansionZoom(Number(clusterId))
            .then((targetZoom: number) => {
              const coords = feature.geometry;
              if (coords.type !== 'Point') return;
              map.easeTo({
                center: coords.coordinates as [number, number],
                zoom: targetZoom,
                duration: 600
              });
            })
            .catch(() => {});
        });

        map.on('click', LAYER_UNCLUSTERED_ID, (e) => {
          const feature = e.features?.[0];
          const id = feature?.properties?.id as string | undefined;
          const biz = businessesByIdRef.current.get(String(id));
          if (biz) onSelectBusiness(biz);
        });

        // Cursor pointers
        map.on('mouseenter', LAYER_CLUSTER_ID, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', LAYER_CLUSTER_ID, () => {
          map.getCanvas().style.cursor = '';
        });
        map.on('mouseenter', LAYER_UNCLUSTERED_ID, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', LAYER_UNCLUSTERED_ID, () => {
          map.getCanvas().style.cursor = '';
        });

        // Hover popup: business name (desktop nicety)
        const popup = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 14,
          anchor: 'bottom'
        });
        map.on('mouseenter', LAYER_UNCLUSTERED_ID, (e) => {
          const feature = e.features?.[0];
          if (!feature) return;
          const coords = feature.geometry;
          if (coords.type !== 'Point') return;
          popup
            .setLngLat(coords.coordinates as [number, number])
            .setHTML(
              `<div style="font-family:'Plus Jakarta Sans',sans-serif;background:#0f2942;color:#fff;padding:6px 10px;border-radius:8px;font-size:12px;font-weight:700;white-space:nowrap;box-shadow:0 8px 16px -4px rgba(15,41,66,0.3)">
                ${feature.properties?.name ?? ''}
              </div>`
            )
            .addTo(map);
        });
        map.on('mouseleave', LAYER_UNCLUSTERED_ID, () => popup.remove());
      } else {
        // Update data in place — cheap, no layer rebuild
        (map.getSource(SOURCE_ID) as GeoJSONSource).setData(businessesToGeoJSON(businesses));
      }
    };

    if (map.isStyleLoaded()) {
      setupLayers();
    } else {
      map.once('style.load', setupLayers);
    }
  }, [businesses, onSelectBusiness]);

  // Selection highlight via feature-state (no marker recreation)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !map.getSource(SOURCE_ID)) return;

    const prevId = selectionStateRef.current;
    const nextId = selectedBusiness?.id ?? null;

    const applyState = (id: string, selected: boolean) => {
      try {
        map.setFeatureState({ source: SOURCE_ID, id }, { selected });
      } catch {
        // feature not in viewport — ignore
      }
    };

    if (prevId && prevId !== nextId) applyState(prevId, false);
    if (nextId && nextId !== prevId) applyState(nextId, true);

    selectionStateRef.current = nextId;
  }, [selectedBusiness, businesses]);

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
