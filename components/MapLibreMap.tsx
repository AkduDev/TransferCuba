'use client';

import React, { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, MapMouseEvent } from 'maplibre-gl';
import { Protocol, PMTiles } from 'pmtiles';
import { Business, CATEGORY_EMOJI } from '@/lib/cuba-data';

export interface ClusterInfo {
  businesses: Business[];
  center: [number, number]; // [lat, lng]
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
  routeGeometry?: { type: 'LineString'; coordinates: [number, number][] } | null;
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

const SOURCE_ID = 'businesses-source';
const LAYER_CLUSTER_ID = 'clusters-layer';
const LAYER_CLUSTER_COUNT_ID = 'cluster-count-layer';
const LAYER_SELECTED_HALO_ID = 'selected-business-halo';
const LAYER_UNCLUSTERED_ID = 'unclustered-layer';
const LAYER_UNCLUSTERED_SEL_ID = 'unclustered-selected-layer';

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

function businessesToGeoJSON(
  businesses: Business[],
  selectedId: string | null
): GeoJSON.FeatureCollection {
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
        selected: biz.id === selectedId,
        icon: iconIdFor(biz, false),
        iconSel: iconIdFor(biz, true)
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
  onClusterClick,
  routeGeometry,
  onViewportChange,
  mapRef,
  onMapReady
}: MapLibreMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const pinMarkerRef = useRef<maplibregl.Marker | null>(null);
  const lastViewRef = useRef<{ lat: number; lng: number; zoom: number } | null>(null);
  const iconsCacheRef = useRef<Set<string>>(new Set());
  const businessesByIdRef = useRef<Map<string, Business>>(new Map());
  const mapInteractiveRef = useRef(false);
  const setupLayersRef = useRef<(() => Promise<void>) | null>(null);

  const centerLat = center[0];
  const centerLng = center[1];

  const callbacksRef = useRef({
    isPinningMode,
    onPinLocationChange,
    onMapClick,
    onClusterClick,
    onViewportChange,
    onMapReady
  });

  useEffect(() => {
    callbacksRef.current = {
      isPinningMode,
      onPinLocationChange,
      onMapClick,
      onClusterClick,
      onViewportChange,
      onMapReady
    };
  }, [isPinningMode, onPinLocationChange, onMapClick, onClusterClick, onViewportChange, onMapReady]);

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

  // Businesses GeoJSON layer — cluster + symbol pins (GPU rendered)
  useEffect(() => {
const map = mapInstanceRef.current;
      businessesByIdRef.current = new Map(businesses.map((b) => [b.id, b]));

      const setupLayers = async () => {
        const map = mapInstanceRef.current;
        if (!map) return;

        // Register any new runtime icons for this batch of businesses.
        // addImage exige un HTMLImageElement CARGADO (o ImageBitmap): un string
        // dataURL o una Image sin decodificar produce width 0 y un
        // IndexSizeError que tumba el mapa (MapErrorBoundary).
        const pending: Promise<void>[] = [];
        businessesRef.current.forEach((biz) => {
          [false, true].forEach((sel) => {
            const id = iconIdFor(biz, sel);
            if (!map.hasImage(id) && !iconsCacheRef.current.has(id)) {
              iconsCacheRef.current.add(id);
              const iconCanvas = makePinIcon(CATEGORY_EMOJI[biz.category] ?? '📍', statusColor(biz), {
                selected: sel,
                activeNow: biz.transferActiveNow
              });
              pending.push(
                createImageBitmap(iconCanvas)
                  .then((bitmap) => {
                    if (mapInstanceRef.current && !mapInstanceRef.current.hasImage(id)) {
                      mapInstanceRef.current.addImage(id, bitmap, { pixelRatio: 2 });
                    }
                  })
                  .catch(() => {
                    // fallback: elemento <img> con decode()
                    const el = new Image();
                    el.src = iconCanvas.toDataURL('image/png');
                    pending.push(
                      el
                        .decode()
                        .then(() => {
                          if (mapInstanceRef.current && !mapInstanceRef.current.hasImage(id)) {
                            mapInstanceRef.current.addImage(id, el, { pixelRatio: 2 });
                          }
                        })
                        .catch(() => {
                          iconsCacheRef.current.delete(id);
                        })
                    );
                  })
              );
            }
          });
        });
      await Promise.all(pending);

      try {
        if (!map.getSource(SOURCE_ID)) {
          map.addSource(SOURCE_ID, {
            type: 'geojson',
            data: businessesToGeoJSON(businessesRef.current, selectedBusinessRef.current?.id ?? null),
            cluster: true,
            clusterRadius: 55,
            clusterMaxZoom: 14,
            clusterProperties: {
              active: ['+', ['case', ['get', 'activeNow'], 1, 0]]
            }
          });
        }

        const ensureLayer = (layer: maplibregl.LayerSpecification) => {
          if (!map.getLayer(layer.id)) map.addLayer(layer);
        };

        // Clusters: single layer, color driven by `active` count from
        // clusterProperties. Green = at least one transfer-active business;
        // navy = none active. (Sprint 9)
        ensureLayer({
          id: LAYER_CLUSTER_ID,
          type: 'circle',
          source: SOURCE_ID,
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': [
              'case',
              ['>', ['get', 'active'], 0],
              COLOR_VERIFIED,
              COLOR_SELECTED
            ],
            'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 25, 24],
            'circle-opacity': 0.92,
            'circle-stroke-width': 3,
            'circle-stroke-color': '#ffffff'
          }
        });

        ensureLayer({
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

        // Individual pins (sin feature-state: MapLibre de este proyecto descarta
// silenciosamente capas con expresiones feature-state). El pin seleccionado
// vive en su propia capa, filtrada por la property `selected` del GeoJSON.
ensureLayer({
          id: LAYER_UNCLUSTERED_ID,
          type: 'symbol',
          source: SOURCE_ID,
          filter: ['all', ['!', ['has', 'point_count']], ['!=', ['get', 'selected'], true]],
          layout: {
            'icon-image': ['get', 'icon'],
            'icon-size': 1,
            'icon-allow-overlap': false,
            'icon-ignore-placement': true,
            'icon-anchor': 'bottom',
            'icon-padding': 4
          }
        });

        // Pin seleccionado: icono sel + tamaño mayor (estilo Google Maps).
        ensureLayer({
          id: LAYER_UNCLUSTERED_SEL_ID,
          type: 'symbol',
          source: SOURCE_ID,
          filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'selected'], true]],
          layout: {
            'icon-image': ['get', 'iconSel'],
            'icon-size': 1.18,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'icon-anchor': 'bottom',
            'icon-padding': 4
          }
        });

        // Halo suave de selección (Sprint 9): emerald glow bajo el pin elegido.
        ensureLayer({
          id: LAYER_SELECTED_HALO_ID,
          type: 'circle',
          source: SOURCE_ID,
          filter: ['all', ['!=', ['has', 'point_count'], true], ['==', ['get', 'selected'], true]],
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 16, 18, 22],
            'circle-color': COLOR_VERIFIED,
            'circle-opacity': 0.28,
            'circle-blur': 0.55,
            'circle-translate': [0, 22]
          }
        });
        if (map.getLayer(LAYER_SELECTED_HALO_ID) && map.getLayer(LAYER_UNCLUSTERED_SEL_ID)) {
          map.moveLayer(LAYER_SELECTED_HALO_ID, LAYER_UNCLUSTERED_SEL_ID);
        }

        // Interacción (click/cursor/popup) — se registra solo la primera vez
        if (!mapInteractiveRef.current) {
          mapInteractiveRef.current = true;

          const onClusterBubbleClick = async (e: maplibregl.MapLayerMouseEvent) => {
            const feature = e.features?.[0];
            if (!feature) return;
            const clusterId = Number(feature.properties?.cluster_id);
            const src = map.getSource(SOURCE_ID) as GeoJSONSource;
            const coords = feature.geometry;
            if (coords.type !== 'Point') return;
            const center: [number, number] = coords.coordinates as [number, number]; // [lng,lat]

            const cb = callbacksRef.current.onClusterClick;
            try {
              const leaves = await src.getClusterLeaves(clusterId, 8, 0);
              const bizs = leaves
                .map((l) => businessesByIdRef.current.get(String(l.properties?.id)))
                .filter((b): b is Business => Boolean(b));
              if (bizs.length > 0 && cb) {
                cb({ businesses: bizs, center: [center[1], center[0]] });
                return;
              }
            } catch {
              // ignore, fall through to zoom
            }

            // Fallback: zoom into the cluster (Google '+' behaviour).
            const targetZoom = await src.getClusterExpansionZoom(clusterId);
            map.easeTo({ center, zoom: targetZoom, duration: 600 });
          };

          map.on('click', LAYER_CLUSTER_ID, onClusterBubbleClick);

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
          map.on('mouseenter', LAYER_CLUSTER_ID, () => {
            map.getCanvas().style.cursor = 'pointer';
          });
          map.on('mouseleave', LAYER_CLUSTER_ID, () => {
            map.getCanvas().style.cursor = '';
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

        // Siempre refresca los datos (inserta/actualiza features o clusteriza)
        (map.getSource(SOURCE_ID) as GeoJSONSource).setData(
          businessesToGeoJSON(businessesRef.current, selectedBusinessRef.current?.id ?? null)
        );
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
          map.getSource(SOURCE_ID) &&
          map.getLayer(LAYER_CLUSTER_ID) &&
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
  }, [businesses, onSelectBusiness]);

  // Selection highlight: el id seleccionado viaja en el GeoJSON (property
  // `selected`), así que basta refrescar los datos (setupLayers es idempotente).
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !map.getSource(SOURCE_ID)) return;
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
