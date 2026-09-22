'use client';

import React, { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, MapMouseEvent } from 'maplibre-gl';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import { Protocol, PMTiles } from 'pmtiles';
import { Business } from '@/lib/cuba-data';
import type { AvailableDeliveryDTO, DeliveryStatus } from '@/lib/delivery-client';

export interface ClusterInfo {
  businesses: Business[];
  center: [number, number]; // [lat, lng]
  clusterId?: number; // para escalar el conteo mostrado (8+)
  expansionZoom?: number; // zoom al que el cluster se disuelve en pins
}

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
  onClusterClick?: (info: ClusterInfo) => void;
  deliveryPickup?: { lat: number; lng: number; address: string } | null;
  deliveryDropoff?: { lat: number; lng: number; address: string } | null;
  deliveryPicking?: 'pickup' | 'dropoff' | null;
  routeGeometry?: { type: 'LineString'; coordinates: [number, number][] } | null;
  deliveryRequests?: AvailableDeliveryDTO[];
  activeDeliveryTrip?: {
    pickup: { lat: number; lng: number } | null;
    dropoff: { lat: number; lng: number } | null;
    status: DeliveryStatus;
  } | null;
  onDeliveryRequestClick?: (id: string) => void;
  onViewportChange?: (bbox: [number, number, number, number], zoom: number) => void;
  mapRef?: React.RefObject<maplibregl.Map | null>;
  onMapReady?: () => void;
}

// Basemap: PMTiles de Cuba propio (Sprint 4). Por defecto se sirve desde
// /map/cuba.pmtiles (estático, mismo origen, soporta Range). Puede pasarse
// NEXT_PUBLIC_PMTILES_URL para apuntar a otro host (p.ej. R2) sin usar API key.
const PMTILES_URL = process.env.NEXT_PUBLIC_PMTILES_URL || '/map/cuba.pmtiles';
const FALLBACK_STYLE = 'https://tiles.openfreemap.org/styles/positron';

// Registra el protocolo pmtiles:// una sola vez, con el archivo de Cuba.
let pmtilesProtocol: Protocol | null = null;
function ensurePmtilesProtocol(): void {
  if (pmtilesProtocol) return;
  pmtilesProtocol = new Protocol();
  maplibregl.addProtocol('pmtiles', pmtilesProtocol.tile);
  pmtilesProtocol.add(new PMTiles(PMTILES_URL));
}

// MapLibre v6 corre el parseo de tiles en Web Workers. El bundler de Next no
// empaqueta el worker (new Worker(URL relativa)) y queda 404 — el mapa carga
// el estilo pero nunca pide tiles. Se sirve el worker desde /public y se
// fija config.WORKER_URL (mecanismo oficial de MapLibre).
let workerUrlFixed = false;
function ensureWorkerUrl(): void {
  if (workerUrlFixed) return;
  workerUrlFixed = true;
  const config = (
    maplibregl as unknown as { config?: { WORKER_URL?: string } }
  ).config;
  if (config && 'WORKER_URL' in config && !config.WORKER_URL) {
    config.WORKER_URL = '/map/maplibre-gl-worker.mjs';
  }
}

const MVT_SOURCE_ID = 'businesses-mvt';
const SOURCE_SELECTION_ID = 'selected-business-source';
const SOURCE_CLUSTER_HOVER_ID = 'cluster-hover-source';
const LAYER_SELECTED_HALO_ID = 'selected-business-halo';
const LAYER_UNCLUSTERED_ID = 'unclustered-layer';
const LAYER_UNCLUSTERED_SEL_ID = 'unclustered-selected-layer';
const LAYER_CLUSTER_HOVER_ID = 'cluster-hover-halo';

// Delivery layers (Fase 4): solicitudes PENDING del tablón y carrera activa.
const SOURCE_DELIVERY_REQUESTS_ID = 'deliveries-requests-source';
const LAYER_DELIVERY_REQUESTS_ID = 'deliveries-requests-layer';
const SOURCE_DELIVERY_ACTIVE_ID = 'active-delivery-source';
const LAYER_DELIVERY_ACTIVE_LINE_ID = 'active-delivery-line-layer';
const LAYER_DELIVERY_ACTIVE_A_ID = 'active-delivery-a-layer';
const LAYER_DELIVERY_ACTIVE_B_ID = 'active-delivery-b-layer';
const LAYER_DELIVERY_ACTIVE_LABEL_ID = 'active-delivery-label-layer';

// Pin badge colors (design system)
const COLOR_VERIFIED = '#10b981';
const COLOR_REPORTED = '#e11d48';
const COLOR_PENDING = '#f59e0b';
const COLOR_SELECTED = '#0f2942';

function deliveryRequestsToGeoJSON(list: AvailableDeliveryDTO[] | undefined): FeatureCollection {
  const features: Feature<Point>[] = (list ?? []).flatMap((d) => {
    if (!d.pickup) return [];
    return [
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [d.pickup.lng, d.pickup.lat]
        },
        properties: {
          id: d.id,
          code: d.code,
          fragile: d.fragile,
          fare: d.totalFareCup,
          pkg: d.packageType
        }
      }
    ];
  });
  return { type: 'FeatureCollection', features };
}

function activeTripToGeoJSON(
  trip: MapLibreMapProps['activeDeliveryTrip']
): FeatureCollection {
  const features: Feature<LineString | Point>[] = [];
  if (trip?.pickup && trip.dropoff) {
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [trip.pickup.lng, trip.pickup.lat],
          [trip.dropoff.lng, trip.dropoff.lat]
        ]
      },
      properties: {}
    });
    features.push(
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [trip.pickup.lng, trip.pickup.lat] },
        properties: { marker: 'A' }
      },
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [trip.dropoff.lng, trip.dropoff.lat] },
        properties: { marker: 'B' }
      }
    );
  }
  return { type: 'FeatureCollection', features };
}

// --- Layer IDs ---

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
  onClusterClick,
  deliveryPickup,
  deliveryDropoff,
  deliveryPicking,
  routeGeometry,
  deliveryRequests,
  activeDeliveryTrip,
  onDeliveryRequestClick,
  onViewportChange,
  mapRef,
  onMapReady
}: MapLibreMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const pinMarkerRef = useRef<maplibregl.Marker | null>(null);
  const pickupMarkerRef = useRef<maplibregl.Marker | null>(null);
  const dropoffMarkerRef = useRef<maplibregl.Marker | null>(null);
  const lastViewRef = useRef<{ lat: number; lng: number; zoom: number } | null>(null);
  const iconsCacheRef = useRef<Set<string>>(new Set());
  const businessesByIdRef = useRef<Map<string, Business>>(new Map());
  const mapInteractiveRef = useRef(false);
  const deliveryInteractionsReadyRef = useRef(false);
  const setupLayersRef = useRef<(() => Promise<void>) | null>(null);

  const centerLat = center[0];
  const centerLng = center[1];

  const callbacksRef = useRef({
    isPinningMode,
    onPinLocationChange,
    onMapClick,
    onClusterClick,
    onViewportChange,
    onMapReady,
    onDeliveryRequestClick
  });

  useEffect(() => {
    callbacksRef.current = {
      isPinningMode,
      onPinLocationChange,
      onMapClick,
      onClusterClick,
      onViewportChange,
      onMapReady,
      onDeliveryRequestClick
    };
  }, [isPinningMode, onPinLocationChange, onMapClick, onClusterClick, onViewportChange, onMapReady, onDeliveryRequestClick]);

  const businessesRef = useRef(businesses);
  const onSelectBusinessRef = useRef(onSelectBusiness);
  const selectedBusinessRef = useRef(selectedBusiness);

  useEffect(() => {
    businessesRef.current = businesses;
    onSelectBusinessRef.current = onSelectBusiness;
    selectedBusinessRef.current = selectedBusiness;
  });

  // Initialize MapLibre GL instance
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;
    const iconsCache = iconsCacheRef.current;
    let disposed = false;
    let moveendTimer: ReturnType<typeof setTimeout> | null = null;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const initMap = async () => {
      ensureWorkerUrl();
      ensurePmtilesProtocol();
      // Basemap propio (PMTiles Cuba): estilo Google Maps propio, cae a
      // Positron local y por último a OpenFreeMap (gratuito e ilimitado).
      let styleUrl: string | maplibregl.StyleSpecification = FALLBACK_STYLE;
      for (const path of ['/map/transfercuba-style.json', '/map/style.json']) {
        try {
          const styleRes = await fetch(path);
          if (!styleRes.ok) continue;
          const styleJson = (await styleRes.json()) as maplibregl.StyleSpecification;
          const raw = JSON.stringify(styleJson).replace('__PMTILES_URL__', PMTILES_URL);
          styleUrl = JSON.parse(raw) as maplibregl.StyleSpecification;
          break;
        } catch {
          // estilo local no disponible -> siguiente fallback
        }
      }
      if (disposed || !mapContainerRef.current) return;

      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: styleUrl,
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

      map.addControl(
        new maplibregl.AttributionControl({
          compact: true,
          customAttribution: PMTILES_URL
            ? '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a> · TransferCuba'
            : '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> © OpenMapTiles · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OSM</a>'
        }),
        'bottom-left'
      );

      mapInstanceRef.current = map;
      if (mapRef) mapRef.current = map;
      // Debug bridge for Playwright (dev only)
      if (process.env.NODE_ENV !== 'production') {
        (window as unknown as { __MAP__?: maplibregl.Map }).__MAP__ = map;
      }
      lastViewRef.current = { lat: centerLat, lng: centerLng, zoom };

      // Notifica a la UI (controladores de zoom custom) cuando el mapa está listo
      map.once('load', () => {
        callbacksRef.current.onMapReady?.();
        void setupLayersRef.current?.();
      });

      // Container ResizeObserver for seamless responsiveness
      resizeObserver = new ResizeObserver(() => {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.resize();
          }
        }, 100);
      });

      resizeObserver.observe(mapContainerRef.current);

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
    };

    void initMap();

    return () => {
      disposed = true;
      mapInteractiveRef.current = false;
      setupLayersRef.current = null;
      if (moveendTimer) clearTimeout(moveendTimer);
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeObserver?.disconnect();
      iconsCache.clear();
      mapInstanceRef.current?.remove();
      mapInstanceRef.current = null;
      if (mapRef) mapRef.current = null;
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

  // Businesses MVT layer — vector tiles from server (no client clustering)
  useEffect(() => {
const map = mapInstanceRef.current;
      businessesByIdRef.current = new Map(businesses.map((b) => [b.id, b]));

      const setupLayers = async () => {
        const map = mapInstanceRef.current;
        if (!map) return;

      try {
        // ── MVT vector tile source (server-side rendering) ──
        if (!map.getSource(MVT_SOURCE_ID)) {
          map.addSource(MVT_SOURCE_ID, {
            type: 'vector',
            tiles: [`${typeof window !== 'undefined' ? window.location.origin : ''}/api/tiles/{z}/{x}/{y}`],
            minzoom: 0,
            maxzoom: 14
          });
        }

        const ensureLayer = (layer: maplibregl.LayerSpecification) => {
          if (!map.getLayer(layer.id)) map.addLayer(layer);
        };

        // Business pins from MVT: circle colored by status
        ensureLayer({
          id: LAYER_UNCLUSTERED_ID,
          type: 'circle',
          source: MVT_SOURCE_ID,
          'source-layer': 'businesses',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 5, 16, 9],
            'circle-color': [
              'case',
              ['==', ['get', 'status'], 'verified'], COLOR_VERIFIED,
              ['==', ['get', 'status'], 'reported'], COLOR_REPORTED,
              COLOR_PENDING
            ],
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 1.5,
            'circle-opacity': 0.92
          }
        });

        // Category label on top of each pin
        ensureLayer({
          id: LAYER_UNCLUSTERED_SEL_ID,
          type: 'symbol',
          source: MVT_SOURCE_ID,
          'source-layer': 'businesses',
          layout: {
            'text-field': ['get', 'category_icon'],
            'text-font': ['Noto Sans Regular'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 10, 9, 16, 13],
            'text-offset': [0, -1.8],
            'text-allow-overlap': false,
            'text-ignore-placement': true
          },
          paint: {
            'text-color': COLOR_SELECTED
          }
        });

        // ── Selection overlay (GeoJSON, small) ──
        if (!map.getSource(SOURCE_SELECTION_ID)) {
          map.addSource(SOURCE_SELECTION_ID, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
          });
        }

        // Halo de selección (debajo del pin)
        ensureLayer({
          id: LAYER_SELECTED_HALO_ID,
          type: 'circle',
          source: SOURCE_SELECTION_ID,
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 16, 18, 22],
            'circle-color': COLOR_VERIFIED,
            'circle-opacity': 0.28,
            'circle-blur': 0.55,
            'circle-translate': [0, 22]
          }
        });

        // ── Cluster hover halo (kept for zoom-in behavior) ──
        if (!map.getSource(SOURCE_CLUSTER_HOVER_ID)) {
          map.addSource(SOURCE_CLUSTER_HOVER_ID, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
          });
        }
        ensureLayer({
          id: LAYER_CLUSTER_HOVER_ID,
          type: 'circle',
          source: SOURCE_CLUSTER_HOVER_ID,
          paint: {
            'circle-radius': ['get', 'r'],
            'circle-color': COLOR_VERIFIED,
            'circle-opacity': 0.3,
            'circle-blur': 0.5
          }
        });

        // Interacción (click/cursor/popup) — se registra solo la primera vez
        if (!mapInteractiveRef.current) {
          mapInteractiveRef.current = true;

          const onPinClick = (e: maplibregl.MapLayerMouseEvent) => {
            const feature = e.features?.[0];
            const id = feature?.properties?.id as string | undefined;
            const biz = businessesByIdRef.current.get(String(id));
            if (biz) onSelectBusinessRef.current?.(biz);
          };
          map.on('click', LAYER_UNCLUSTERED_ID, onPinClick);
          map.on('click', LAYER_UNCLUSTERED_SEL_ID, onPinClick);

          // Cursor pointers
          const pinLayers = [LAYER_UNCLUSTERED_ID, LAYER_UNCLUSTERED_SEL_ID];
          pinLayers.forEach((layerId) => {
            map.on('mouseenter', layerId, () => {
              map.getCanvas().style.cursor = 'pointer';
            });
            map.on('mouseleave', layerId, () => {
              map.getCanvas().style.cursor = '';
            });
          });

          // Hover popup: business name (desktop nicety)
          const popup = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            offset: 14,
            anchor: 'bottom'
          });
          const onPinEnter = (e: maplibregl.MapLayerMouseEvent) => {
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
          };
          pinLayers.forEach((layerId) => {
            map.on('mouseenter', layerId, onPinEnter);
            map.on('mouseleave', layerId, () => popup.remove());
          });
        }

        // Update selection overlay
        const selId = selectedBusinessRef.current?.id ?? null;
        const selBiz = selId ? businessesByIdRef.current.get(selId) : null;
        const selSrc = map.getSource(SOURCE_SELECTION_ID) as GeoJSONSource | undefined;
        if (selSrc) {
          selSrc.setData(
            selBiz
              ? {
                  type: 'FeatureCollection' as const,
                  features: [
                    {
                      type: 'Feature' as const,
                      geometry: { type: 'Point' as const, coordinates: [selBiz.lng, selBiz.lat] },
                      properties: { id: selBiz.id, name: selBiz.name }
                    }
                  ]
                }
              : { type: 'FeatureCollection' as const, features: [] }
          );
        }
      } catch (setupErr) {
        console.error('setupLayers failed:', setupErr);
      }
    };

    setupLayersRef.current = setupLayers;

    if (!map) return;

    // Style puede tardar en estar listo (glyphs/sprites/PMTiles): reintenta
    // hasta que source + capas queden montadas. Es idempotente (ensureLayer).
    const attempt = async () => {
      for (let i = 0; i < 3; i++) {
        try {
          await setupLayers();
        } catch (err) {
          console.error('setupLayers failed:', err);
        }
        const complete =
          map.getSource(MVT_SOURCE_ID) &&
          map.getLayer(LAYER_UNCLUSTERED_ID) &&
          map.getLayer(LAYER_UNCLUSTERED_SEL_ID) &&
          map.getLayer(LAYER_SELECTED_HALO_ID);
        if (complete) return;
        await new Promise((r) => setTimeout(r, 900));
      }
    };

    if (map.isStyleLoaded()) {
      void attempt();
    } else {
      map.once('style.load', () => void attempt());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Selection highlight: actualiza el overlay GeoJSON del pin seleccionado.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !map.getSource(SOURCE_SELECTION_ID)) return;
    void setupLayersRef.current?.();
  }, [selectedBusiness]);

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

  // Marcadores del flujo de delivery: origen (verde) y destino (rojo).
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    const renderPointMarker = (
      ref: { current: maplibregl.Marker | null },
      point: { lat: number; lng: number; address: string } | null | undefined,
      label: string,
      color: string
    ) => {
      if (ref.current) {
        ref.current.remove();
        ref.current = null;
      }
      if (!point) return;
      const el = document.createElement('div');
      el.className = 'transfercuba-delivery-marker';
      el.innerHTML = `
        <div class="flex flex-col items-center pointer-events-none">
          <div class="px-2 py-0.5 bg-navy text-white text-[11px] font-bold rounded-lg shadow-level-3 border border-navy-hover whitespace-nowrap mb-1">${label}</div>
          <div class="w-7 h-7 rounded-full ${color} text-white border-2 border-white shadow-level-4 flex items-center justify-center font-bold text-sm">${label === 'Salida' ? 'A' : 'B'}</div>
          <div class="w-2 h-2 ${color} rotate-45 -mt-1"></div>
        </div>
      `;
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([point.lng, point.lat])
        .addTo(map);
      ref.current = marker;
    };

    renderPointMarker(pickupMarkerRef, deliveryPickup, 'Salida', 'bg-emerald-brand');
    renderPointMarker(dropoffMarkerRef, deliveryDropoff, 'Destino', 'bg-rose-500');
  }, [deliveryPickup, deliveryDropoff]);

  // Fase 4 — Capas de delivery: solicitudes PENDING (tablón) + carrera activa.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const update = () => {
      const ensureLayer = (layer: maplibregl.LayerSpecification) => {
        if (!map.getLayer(layer.id)) map.addLayer(layer);
      };

      const requestData = deliveryRequestsToGeoJSON(deliveryRequests);
      if (!map.getSource(SOURCE_DELIVERY_REQUESTS_ID)) {
        map.addSource(SOURCE_DELIVERY_REQUESTS_ID, { type: 'geojson', data: requestData });
      } else {
        (map.getSource(SOURCE_DELIVERY_REQUESTS_ID) as GeoJSONSource).setData(requestData);
      }
      ensureLayer({
        id: LAYER_DELIVERY_REQUESTS_ID,
        type: 'circle',
        source: SOURCE_DELIVERY_REQUESTS_ID,
        paint: {
          'circle-radius': 9,
          'circle-color': COLOR_VERIFIED,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
          'circle-opacity': 0.95
        }
      });

      const activeData = activeTripToGeoJSON(activeDeliveryTrip);
      if (!map.getSource(SOURCE_DELIVERY_ACTIVE_ID)) {
        map.addSource(SOURCE_DELIVERY_ACTIVE_ID, { type: 'geojson', data: activeData });
      } else {
        (map.getSource(SOURCE_DELIVERY_ACTIVE_ID) as GeoJSONSource).setData(activeData);
      }
      ensureLayer({
        id: LAYER_DELIVERY_ACTIVE_LINE_ID,
        type: 'line',
        source: SOURCE_DELIVERY_ACTIVE_ID,
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: {
          'line-color': '#0284c7',
          'line-width': 4,
          'line-opacity': 0.7,
          'line-dasharray': [2, 2]
        }
      });
      ensureLayer({
        id: LAYER_DELIVERY_ACTIVE_A_ID,
        type: 'circle',
        source: SOURCE_DELIVERY_ACTIVE_ID,
        filter: ['==', ['get', 'marker'], 'A'],
        paint: {
          'circle-radius': 11,
          'circle-color': COLOR_VERIFIED,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2.5
        }
      });
      ensureLayer({
        id: LAYER_DELIVERY_ACTIVE_B_ID,
        type: 'circle',
        source: SOURCE_DELIVERY_ACTIVE_ID,
        filter: ['==', ['get', 'marker'], 'B'],
        paint: {
          'circle-radius': 11,
          'circle-color': COLOR_REPORTED,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2.5
        }
      });
      ensureLayer({
        id: LAYER_DELIVERY_ACTIVE_LABEL_ID,
        type: 'symbol',
        source: SOURCE_DELIVERY_ACTIVE_ID,
        filter: ['has', 'marker'],
        layout: {
          'text-field': ['get', 'marker'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 11
        },
        paint: {
          'text-color': '#ffffff'
        }
      });

      if (!deliveryInteractionsReadyRef.current) {
        deliveryInteractionsReadyRef.current = true;

        map.on('click', LAYER_DELIVERY_REQUESTS_ID, (e) => {
          const id = e.features?.[0]?.properties?.id as string | undefined;
          if (id) callbacksRef.current.onDeliveryRequestClick?.(id);
        });
        map.on('mouseenter', LAYER_DELIVERY_REQUESTS_ID, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', LAYER_DELIVERY_REQUESTS_ID, () => {
          map.getCanvas().style.cursor = '';
        });

        const popup = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 14,
          anchor: 'bottom'
        });
        const onRequestEnter = (e: maplibregl.MapLayerMouseEvent) => {
          const feature = e.features?.[0];
          const geometry = feature?.geometry;
          if (!feature || geometry?.type !== 'Point') return;
          const p = feature.properties;
          popup
            .setLngLat(geometry.coordinates as [number, number])
            .setHTML(
              `<div style="font-family:'Plus Jakarta Sans',sans-serif;background:#0f2942;color:#fff;padding:6px 10px;border-radius:8px;font-size:12px;font-weight:700;white-space:nowrap;box-shadow:0 8px 16px -4px rgba(15,41,66,0.3)">
                ${String(p?.code ?? '')}${p?.fare != null ? ` · $${Math.round(Number(p?.fare))} CUP` : ''}
              </div>`
            )
            .addTo(map);
        };
        map.on('mouseenter', LAYER_DELIVERY_REQUESTS_ID, onRequestEnter);
        map.on('mouseleave', LAYER_DELIVERY_REQUESTS_ID, () => popup.remove());
      }
    };

    const attempt = async () => {
      for (let i = 0; i < 3; i++) {
        try {
          update();
          return;
        } catch {
          await new Promise((r) => setTimeout(r, 700));
        }
      }
      try {
        update();
      } catch (err) {
        console.error('delivery layers failed:', err);
      }
    };

    if (map.isStyleLoaded()) {
      void attempt();
      return;
    }

    // `style.load` dispara UNA vez y pronto, pero `isStyleLoaded()` sigue en
    // false mientras queden teselas en vuelo. Esperar solo a `style.load`
    // significaba que una actualización posterior del tablón —una solicitud
    // nueva llegando por el stream— se quedaba aguardando un evento ya pasado
    // y el mapa no la pintaba nunca. `idle` sí vuelve a dispararse cada vez
    // que el mapa se asienta, así que sirve de red.
    const alEstarListo = () => {
      map.off('style.load', alEstarListo);
      map.off('idle', alEstarListo);
      void attempt();
    };
    map.on('style.load', alEstarListo);
    map.on('idle', alEstarListo);

    return () => {
      map.off('style.load', alEstarListo);
      map.off('idle', alEstarListo);
    };
  }, [deliveryRequests, activeDeliveryTrip]);

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
    <div className={`relative w-full h-full bg-canvas overflow-hidden ${deliveryPicking ? 'cursor-crosshair' : ''}`}>
      <div id="maplibre-map-canvas" ref={mapContainerRef} className="w-full h-full z-0" />

      {isPinningMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-navy/95 text-white backdrop-blur-md px-4 py-2 rounded-lg text-xs sm:text-sm font-medium shadow-level-3 border border-navy-hover flex items-center gap-2 pointer-events-none animate-pulse">
          <span>📍 Haz clic en el mapa o arrastra el marcador verde hasta tu local</span>
        </div>
      )}

      {deliveryPicking && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-navy/95 text-white backdrop-blur-md px-4 py-2 rounded-lg text-xs sm:text-sm font-medium shadow-level-3 border border-navy-hover flex items-center gap-2 pointer-events-none animate-pulse">
          <span>Haz clic en el mapa para marcar el {deliveryPicking === 'pickup' ? 'origen (A)' : 'destino (B)'}</span>
        </div>
      )}
    </div>
  );
}
