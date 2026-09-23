'use client';

import React, { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, MapMouseEvent } from 'maplibre-gl';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import { Protocol, PMTiles } from 'pmtiles';
import { Business, CATEGORIES, CATEGORY_EMOJI } from '@/lib/cuba-data';
import type { AvailableDeliveryDTO, DeliveryStatus } from '@/lib/delivery-client';

export interface ClusterInfo {
  businesses: Business[];
  center: [number, number]; // [lat, lng]
  clusterId?: number;
  expansionZoom?: number;
}

export interface PinFilters {
  searchQuery: string;
  selectedProvince: string;
  selectedMunicipality: string;
  selectedCategory: string;
  onlyTransfer: boolean;
  onlyActiveNow: boolean;
  filterVerification: string;
  filterQr: boolean;
  filterOnline: boolean;
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
  pinFilters?: PinFilters;
}

const PMTILES_URL = process.env.NEXT_PUBLIC_PMTILES_URL || '/map/cuba.pmtiles';
const FALLBACK_STYLE = 'https://tiles.openfreemap.org/styles/positron';

let pmtilesProtocol: Protocol | null = null;
function ensurePmtilesProtocol(): void {
  if (pmtilesProtocol) return;
  pmtilesProtocol = new Protocol();
  maplibregl.addProtocol('pmtiles', pmtilesProtocol.tile);
  pmtilesProtocol.add(new PMTiles(PMTILES_URL));
}

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
const SOURCE_GEO_ID = 'businesses-geo';
const SOURCE_SELECTION_ID = 'selected-business-source';
const SOURCE_CLUSTER_HOVER_ID = 'cluster-hover-source';
const LAYER_SELECTED_HALO_ID = 'selected-business-halo';
const LAYER_MVT_PINS_ID = 'unclustered-layer';
const LAYER_MVT_LABELS_ID = 'unclustered-label-layer';
const LAYER_GEO_PINS_ID = 'geo-pins-layer';
const LAYER_GEO_LABELS_ID = 'geo-labels-layer';
const LAYER_CLUSTERS_ID = 'clusters-layer';
const LAYER_CLUSTER_COUNT_ID = 'cluster-count-layer';
const LAYER_PAYMENT_ICONS_ID = 'payment-icons-layer';
const LAYER_CLUSTER_HOVER_ID = 'cluster-hover-halo';

const SOURCE_DELIVERY_REQUESTS_ID = 'deliveries-requests-source';
const LAYER_DELIVERY_REQUESTS_ID = 'deliveries-requests-layer';
const SOURCE_DELIVERY_ACTIVE_ID = 'active-delivery-source';
const LAYER_DELIVERY_ACTIVE_LINE_ID = 'active-delivery-line-layer';
const LAYER_DELIVERY_ACTIVE_A_ID = 'active-delivery-a-layer';
const LAYER_DELIVERY_ACTIVE_B_ID = 'active-delivery-b-layer';
const LAYER_DELIVERY_ACTIVE_LABEL_ID = 'active-delivery-label-layer';

const COLOR_TRANSFER_ACTIVE = '#10b981';
const COLOR_REPORTED = '#e11d48';
const COLOR_DEFAULT = '#0f2942';
const COLOR_SELECTED_HALO = '#10b981';
const COLOR_CERULEAN = '#0284c7';

const CLUSTER_MAX_ZOOM = 14;
const LABEL_MIN_ZOOM = 11;
const MVT_MAX_ZOOM = 14;

type FilterSpec = maplibregl.FilterSpecification;
type Cond = boolean | maplibregl.ExpressionSpecification;

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function businessStatus(b: Business): string {
  if (b.reportsCount > 0) return 'reported';
  if (b.transferVerified) return 'verified';
  return 'pending';
}

function businessesToGeoJSON(list: Business[]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: list.map((b) => {
      const codes: string[] = [];
      if (b.transferDetails?.transfermovil) codes.push('TM');
      if (b.transferDetails?.enzona) codes.push('EZ');
      if (b.transferDetails?.qrPayment) codes.push('QR');
      if (b.transferDetails?.onlineGateway) codes.push('Online');
      if (b.transferDetails?.cash) codes.push('Cash');
      const payment_codes = codes.length ? codes.join(' ') : '';

      return ({
        type: 'Feature',
        id: b.id,
        geometry: { type: 'Point', coordinates: [b.lng, b.lat] },
        properties: {
          id: b.id,
          name: b.name,
          label: `${b.name} ${CATEGORY_EMOJI[b.category] ?? '🏪'}`,
          payment_codes,
          category: b.category,
          province: b.province,
          municipality: b.municipality,
          accepts_transfer: b.acceptsTransfer,
          transfer_active_now: b.transferActiveNow,
          transfer_verified: b.transferVerified,
          rating: b.rating,
          has_delivery: Boolean(b.hasDelivery),
          qr_payment: Boolean(b.transferDetails?.qrPayment),
          online_payment: Boolean(b.transferDetails?.onlineGateway),
          cash: Boolean(b.transferDetails?.cash),
          status: businessStatus(b)
        }
      });
    })
  };
}

function pinColorExpr(): maplibregl.ExpressionSpecification {
  return [
    'case',
    ['==', ['get', 'status'], 'reported'], COLOR_REPORTED,
    ['==', ['get', 'transfer_active_now'], true], COLOR_TRANSFER_ACTIVE,
    COLOR_DEFAULT
  ] as unknown as maplibregl.ExpressionSpecification;
}

function pinStrokeColorExpr(): maplibregl.ExpressionSpecification {
  return [
    'case',
    ['==', ['get', 'has_delivery'], true], COLOR_TRANSFER_ACTIVE,
    '#ffffff'
  ] as unknown as maplibregl.ExpressionSpecification;
}

function pinRadiusExpr(): maplibregl.ExpressionSpecification {
  return [
    'case',
    ['coalesce', ['feature-state', 'selected'], false], 13,
    ['interpolate', ['linear'], ['zoom'], 10, 5, 16, 9]
  ] as unknown as maplibregl.ExpressionSpecification;
}

function pinStrokeWidthExpr(): maplibregl.ExpressionSpecification {
  return [
    'case',
    ['coalesce', ['feature-state', 'selected'], false], 3,
    1.5
  ] as unknown as maplibregl.ExpressionSpecification;
}

function labelLayout(): Record<string, unknown> {
  return {
    'text-field': ['get', 'label'],
    'text-font': ['Noto Sans Bold'],
    'text-size': ['interpolate', ['linear'], ['zoom'], 11, 11, 15, 13, 18, 15],
    'text-anchor': 'top',
    'text-offset': [0, 1.5],
    'text-allow-overlap': false,
    'text-ignore-placement': false,
    'text-optional': true,
    'text-max-width': 7,
    'text-line-height': 1.1,
    'text-padding': 2
  };
}

function labelPaint(): Record<string, unknown> {
  return {
    'text-color': COLOR_DEFAULT,
    'text-halo-color': '#ffffff',
    'text-halo-width': 1.4
  };
}

function buildPopupHtml(biz: Business | undefined): string {
  if (!biz) return '';
  const emoji = CATEGORY_EMOJI[biz.category] ?? '🏪';
  const catLabel = CATEGORIES.find((c) => c.id === biz.category)?.label ?? biz.category;
  const photo = biz.photos?.[0];
  const rating = biz.rating > 0 ? `★ ${biz.rating.toFixed(1)}` : '';
  const payments: string[] = [];
  if (biz.transferDetails?.transfermovil) payments.push('TM');
  if (biz.transferDetails?.enzona) payments.push('EZ');
  if (biz.transferDetails?.qrPayment) payments.push('QR');
  if (biz.transferDetails?.onlineGateway) payments.push('Online');

  const media = photo
    ? `<img src="${esc(photo)}" alt="" style="width:100%;height:96px;object-fit:cover;display:block" referrerpolicy="no-referrer" loading="lazy" />`
    : `<div style="width:100%;height:72px;background:linear-gradient(135deg,#0f2942,#1e3a5f);display:flex;align-items:center;justify-content:center;font-size:28px">${emoji}</div>`;

  const badges: string[] = [];
  if (biz.transferActiveNow) {
    badges.push(
      `<span style="display:inline-flex;align-items:center;gap:3px;background:#ecfdf5;color:#059669;border:1px solid #a7f3d0;border-radius:999px;padding:1px 7px;font-size:10px;font-weight:700">● Activa</span>`
    );
  }
  if (biz.hasDelivery) {
    badges.push(
      `<span style="display:inline-flex;align-items:center;gap:3px;background:#eff6ff;color:#0284c7;border:1px solid #bfdbfe;border-radius:999px;padding:1px 7px;font-size:10px;font-weight:700">🚚 Delivery</span>`
    );
  }
  if (biz.transferVerified) {
    badges.push(
      `<span style="display:inline-flex;align-items:center;gap:3px;background:#f1f5f9;color:#334155;border:1px solid #e2e8f0;border-radius:999px;padding:1px 7px;font-size:10px;font-weight:700">✓ Verificado</span>`
    );
  }

  return `
    <div class="tc-popup" style="font-family:inherit;width:220px;max-width:220px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 12px 24px -6px rgba(15,41,66,.28);border:1px solid #e2e8f0">
      ${media}
      <div style="padding:9px 11px 11px">
        <div style="font-weight:800;font-size:13px;color:#0f2942;line-height:1.25;margin-bottom:2px">${esc(biz.name)}</div>
        <div style="font-size:11px;color:#64748b;display:flex;align-items:center;gap:4px;flex-wrap:wrap">
          <span>${emoji} ${esc(catLabel)}</span>
          ${rating ? `<span style="color:#f59e0b;font-weight:700">${rating}</span>` : ''}
        </div>
        ${biz.address ? `<div style="font-size:11px;color:#64748b;margin-top:3px;line-height:1.35">${esc(biz.address)}</div>` : ''}
        ${
          payments.length
            ? `<div style="display:flex;gap:4px;margin-top:6px;flex-wrap:wrap">${payments
                .map(
                  (p) =>
                    `<span style="background:#f1f5f9;color:#334155;border-radius:6px;padding:1px 6px;font-size:10px;font-weight:700">${esc(p)}</span>`
                )
                .join('')}</div>`
            : ''
        }
        ${badges.length ? `<div style="display:flex;gap:4px;margin-top:6px;flex-wrap:wrap">${badges.join('')}</div>` : ''}
      </div>
    </div>`;
}

function defaultPinFilters(): PinFilters {
  return {
    searchQuery: '',
    selectedProvince: 'all',
    selectedMunicipality: 'all',
    selectedCategory: 'all',
    onlyTransfer: false,
    onlyActiveNow: false,
    filterVerification: 'all',
    filterQr: false,
    filterOnline: false
  };
}

function buildMvtPinFilter(f: PinFilters): FilterSpec {
  const searchActive = f.searchQuery.trim() !== '';
  const conds: Cond[] = [['>', ['zoom'], CLUSTER_MAX_ZOOM] as maplibregl.ExpressionSpecification];
  if (searchActive) {
    conds.push(['in', ['get', 'id'], ['literal', []]] as maplibregl.ExpressionSpecification);
    return ['all', ...conds] as FilterSpec;
  }
  if (f.selectedProvince && f.selectedProvince !== 'all') {
    conds.push([
      '==',
      ['downcase', ['get', 'province']],
      f.selectedProvince.toLowerCase()
    ] as maplibregl.ExpressionSpecification);
  }
  if (f.selectedMunicipality && f.selectedMunicipality !== 'all') {
    conds.push([
      '==',
      ['downcase', ['get', 'municipality']],
      f.selectedMunicipality.toLowerCase()
    ] as maplibregl.ExpressionSpecification);
  }
  if (f.selectedCategory && f.selectedCategory !== 'all') {
    conds.push(['==', ['get', 'category'], f.selectedCategory] as maplibregl.ExpressionSpecification);
  }
  if (f.onlyTransfer) conds.push(['==', ['get', 'accepts_transfer'], true] as maplibregl.ExpressionSpecification);
  if (f.onlyActiveNow) conds.push(['==', ['get', 'transfer_active_now'], true] as maplibregl.ExpressionSpecification);
  if (f.filterQr) conds.push(['==', ['get', 'qr_payment'], true] as maplibregl.ExpressionSpecification);
  if (f.filterOnline) conds.push(['==', ['get', 'online_payment'], true] as maplibregl.ExpressionSpecification);
  if (f.filterVerification && f.filterVerification !== 'all') {
    conds.push(['==', ['get', 'status'], f.filterVerification] as maplibregl.ExpressionSpecification);
  }
  return ['all', ...conds] as FilterSpec;
}

function buildMvtLabelFilter(f: PinFilters): FilterSpec {
  const base = buildMvtPinFilter(f);
  const zoomCond: Cond = ['>=', ['zoom'], LABEL_MIN_ZOOM] as maplibregl.ExpressionSpecification;
  if (Array.isArray(base) && base[0] === 'all') {
    const rest = (base as unknown[]).slice(1);
    return ['all', ...rest, zoomCond] as FilterSpec;
  }
  return ['all', base as Cond, zoomCond] as FilterSpec;
}

function buildGeoPinFilter(searchActive: boolean): FilterSpec | null {
  if (searchActive) return null;
  return ['<=', ['zoom'], CLUSTER_MAX_ZOOM] as unknown as FilterSpec;
}

function buildGeoLabelFilter(searchActive: boolean): FilterSpec | null {
  const zoomHigh: Cond = ['>=', ['zoom'], LABEL_MIN_ZOOM] as maplibregl.ExpressionSpecification;
  if (searchActive) return zoomHigh as FilterSpec;
  return ['all', ['<=', ['zoom'], CLUSTER_MAX_ZOOM] as Cond, zoomHigh] as FilterSpec;
}

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
  onMapReady,
  pinFilters
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
  const selectedIdRef = useRef<string | null>(null);
  const pinFiltersRef = useRef<PinFilters>(pinFilters ?? defaultPinFilters());

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
    businessesByIdRef.current = new Map(businesses.map((b) => [b.id, b]));
    const src = mapInstanceRef.current?.getSource(SOURCE_GEO_ID) as
      | GeoJSONSource
      | undefined;
    if (src) src.setData(businessesToGeoJSON(businesses));
  });

  useEffect(() => {
    pinFiltersRef.current = pinFilters ?? defaultPinFilters();
  });

  const applyPinFilters = (map: maplibregl.Map) => {
    const f = pinFiltersRef.current;
    const searchActive = f.searchQuery.trim() !== '';
    const mvtFilter = buildMvtPinFilter(f);
    const mvtLabelFilter = buildMvtLabelFilter(f);
    const geoFilter = buildGeoPinFilter(searchActive);
    const geoLabelFilter = buildGeoLabelFilter(searchActive);

    if (map.getLayer(LAYER_MVT_PINS_ID)) map.setFilter(LAYER_MVT_PINS_ID, mvtFilter);
    if (map.getLayer(LAYER_MVT_LABELS_ID)) map.setFilter(LAYER_MVT_LABELS_ID, mvtLabelFilter);
    if (map.getLayer(LAYER_GEO_PINS_ID)) map.setFilter(LAYER_GEO_PINS_ID, geoFilter);
    if (map.getLayer(LAYER_GEO_LABELS_ID)) map.setFilter(LAYER_GEO_LABELS_ID, geoLabelFilter);
  };

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const run = () => applyPinFilters(map);
    if (map.isStyleLoaded()) run();
    else map.once('style.load', run);
  }, [
    pinFilters?.searchQuery,
    pinFilters?.selectedProvince,
    pinFilters?.selectedMunicipality,
    pinFilters?.selectedCategory,
    pinFilters?.onlyTransfer,
    pinFilters?.onlyActiveNow,
    pinFilters?.filterVerification,
    pinFilters?.filterQr,
    pinFilters?.filterOnline
  ]);

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
      if (process.env.NODE_ENV !== 'production') {
        (window as unknown as { __MAP__?: maplibregl.Map }).__MAP__ = map;
      }
      lastViewRef.current = { lat: centerLat, lng: centerLng, zoom };

      map.once('load', () => {
        callbacksRef.current.onMapReady?.();
        void setupLayersRef.current?.();
      });

      resizeObserver = new ResizeObserver(() => {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.resize();
          }
        }, 100);
      });

      resizeObserver.observe(mapContainerRef.current);

      map.on('click', (e: MapMouseEvent) => {
        const current = callbacksRef.current;
        if (current.isPinningMode && current.onPinLocationChange) {
          current.onPinLocationChange({ lat: e.lngLat.lat, lng: e.lngLat.lng });
        } else if (current.onMapClick) {
          current.onMapClick({ lat: e.lngLat.lat, lng: e.lngLat.lng });
        }
      });

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

  // Sources + layers: MVT (zoom alto), GeoJSON con clusters (zoom bajo), labels
  useEffect(() => {
    const map = mapInstanceRef.current;
    businessesByIdRef.current = new Map(businesses.map((b) => [b.id, b]));

    const setupLayers = async () => {
      const map = mapInstanceRef.current;
      if (!map) return;

      try {
        if (!map.getSource(MVT_SOURCE_ID)) {
          map.addSource(MVT_SOURCE_ID, {
            type: 'vector',
            tiles: [`${typeof window !== 'undefined' ? window.location.origin : ''}/api/tiles/{z}/{x}/{y}`],
            minzoom: 0,
            maxzoom: MVT_MAX_ZOOM,
            promoteId: { businesses: 'id' }
          });
        }

        if (!map.getSource(SOURCE_GEO_ID)) {
          map.addSource(SOURCE_GEO_ID, {
            type: 'geojson',
            data: businessesToGeoJSON(businessesRef.current),
            cluster: true,
            clusterRadius: 50,
            clusterMaxZoom: CLUSTER_MAX_ZOOM,
            promoteId: 'id'
          });
        } else {
          (map.getSource(SOURCE_GEO_ID) as GeoJSONSource).setData(
            businessesToGeoJSON(businessesRef.current)
          );
        }

        const ensureLayer = (layer: maplibregl.LayerSpecification) => {
          if (!map.getLayer(layer.id)) map.addLayer(layer);
        };

        ensureLayer({
          id: LAYER_SELECTED_HALO_ID,
          type: 'circle',
          source: SOURCE_SELECTION_ID,
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 16, 18, 22],
            'circle-color': COLOR_SELECTED_HALO,
            'circle-opacity': 0.28,
            'circle-blur': 0.55,
            'circle-translate': [0, 22]
          }
        });

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
            'circle-color': COLOR_TRANSFER_ACTIVE,
            'circle-opacity': 0.3,
            'circle-blur': 0.5
          }
        });

        ensureLayer({
          id: LAYER_CLUSTERS_ID,
          type: 'circle',
          source: SOURCE_GEO_ID,
          filter: ['has', 'point_count'] as unknown as FilterSpec,
          paint: {
            'circle-color': [
              'step',
              ['get', 'point_count'],
              '#0f2942',
              10, '#1e3a5f',
              30, '#0369a1',
              50, '#0284c7'
            ],
            'circle-radius': [
              'step',
              ['get', 'point_count'],
              16,
              10, 20,
              30, 24,
              50, 28
            ],
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 2.5
          }
        });

        ensureLayer({
          id: LAYER_CLUSTER_COUNT_ID,
          type: 'symbol',
          source: SOURCE_GEO_ID,
          filter: ['has', 'point_count'] as unknown as FilterSpec,
          layout: {
            'text-field': ['get', 'point_count_abbreviated'],
            'text-font': ['Noto Sans Bold'],
            'text-size': ['step', ['get', 'point_count'], 12, 10, 13, 30, 14]
          },
          paint: {
            'text-color': '#ffffff'
          }
        });

        ensureLayer({
          id: LAYER_GEO_PINS_ID,
          type: 'circle',
          source: SOURCE_GEO_ID,
          filter: ['!', ['has', 'point_count']] as unknown as FilterSpec,
          paint: {
            'circle-radius': pinRadiusExpr(),
            'circle-color': pinColorExpr(),
            'circle-stroke-color': pinStrokeColorExpr(),
            'circle-stroke-width': pinStrokeWidthExpr(),
            'circle-opacity': 0.95
          }
        });

        ensureLayer({
          id: LAYER_GEO_LABELS_ID,
          type: 'symbol',
          source: SOURCE_GEO_ID,
          filter: [
            'all',
            ['!', ['has', 'point_count']] as Cond,
            ['>=', ['zoom'], LABEL_MIN_ZOOM] as Cond
          ] as FilterSpec,
          layout: labelLayout(),
          paint: labelPaint()
        });

        ensureLayer({
          id: LAYER_PAYMENT_ICONS_ID,
          type: 'symbol',
          source: SOURCE_GEO_ID,
          filter: [
            'all',
            ['!', ['has', 'point_count']] as Cond,
            ['>', ['zoom'], CLUSTER_MAX_ZOOM] as Cond
          ] as FilterSpec,
          layout: {
            'text-field': ['get', 'payment_codes'],
            'text-font': ['Noto Sans Regular'],
            'text-size': 9,
            'text-offset': [0, 1.8],
            'text-anchor': 'top',
            'text-allow-overlap': false,
            'text-ignore-placement': false
          },
          paint: {
            'text-color': '#334155',
            'text-halo-color': '#ffffff',
            'text-halo-width': 1
          }
        });

        ensureLayer({
          id: LAYER_MVT_PINS_ID,
          type: 'circle',
          source: MVT_SOURCE_ID,
          'source-layer': 'businesses',
          paint: {
            'circle-radius': pinRadiusExpr(),
            'circle-color': pinColorExpr(),
            'circle-stroke-color': pinStrokeColorExpr(),
            'circle-stroke-width': pinStrokeWidthExpr(),
            'circle-opacity': 0.95
          }
        });

        ensureLayer({
          id: LAYER_MVT_LABELS_ID,
          type: 'symbol',
          source: MVT_SOURCE_ID,
          'source-layer': 'businesses',
          layout: labelLayout(),
          paint: labelPaint()
        });

        if (!map.getSource(SOURCE_SELECTION_ID)) {
          map.addSource(SOURCE_SELECTION_ID, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
          });
        }

        applyPinFilters(map);

        if (!mapInteractiveRef.current) {
          mapInteractiveRef.current = true;

          const onPinClick = (e: maplibregl.MapLayerMouseEvent) => {
            const feature = e.features?.[0];
            const id = feature?.properties?.id as string | undefined;
            if (!id) return;
            const biz = businessesByIdRef.current.get(String(id));
            if (biz) onSelectBusinessRef.current?.(biz);
          };
          const pinLayers = [
            LAYER_MVT_PINS_ID,
            LAYER_MVT_LABELS_ID,
            LAYER_GEO_PINS_ID,
            LAYER_GEO_LABELS_ID
          ];
          pinLayers.forEach((layerId) => {
            map.on('click', layerId, onPinClick);
          });

          const popup = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            offset: 16,
            anchor: 'bottom',
            maxWidth: '260px',
            className: 'tc-map-tooltip'
          });

          const onPinEnter = (e: maplibregl.MapLayerMouseEvent) => {
            const feature = e.features?.[0];
            if (!feature) return;
            const geometry = feature.geometry;
            if (geometry.type !== 'Point') return;
            const id = String(feature.properties?.id ?? '');
            const biz = businessesByIdRef.current.get(id);
            const html = buildPopupHtml(biz);
            if (!html) return;
            popup
              .setLngLat(geometry.coordinates as [number, number])
              .setHTML(html)
              .addTo(map);
          };

          pinLayers.forEach((layerId) => {
            map.on('mouseenter', layerId, () => {
              map.getCanvas().style.cursor = 'pointer';
            });
            map.on('mouseleave', layerId, () => {
              map.getCanvas().style.cursor = '';
            });
            map.on('mouseenter', layerId, onPinEnter);
            map.on('mouseleave', layerId, () => popup.remove());
          });

          const onClusterClick = async (e: maplibregl.MapLayerMouseEvent) => {
            const feature = e.features?.[0];
            if (!feature || feature.geometry.type !== 'Point') return;
            const clusterId = Number(feature.properties?.cluster_id);
            if (!Number.isFinite(clusterId)) return;
            const coords = feature.geometry.coordinates as [number, number];
            const src = map.getSource(SOURCE_GEO_ID) as GeoJSONSource | undefined;
            if (!src) return;
            try {
              const expansionZoom = await src.getClusterExpansionZoom(clusterId);
              const leaves = await Promise.resolve(
                src.getClusterLeaves(clusterId, 1000, 0)
              );
              const list = leaves
                .map((leaf) => businessesByIdRef.current.get(String(leaf.properties?.id)))
                .filter((b): b is Business => Boolean(b));
              callbacksRef.current.onClusterClick?.({
                businesses: list,
                center: [coords[1], coords[0]],
                clusterId,
                expansionZoom
              });
            } catch {
              map.easeTo({ center: coords, zoom: map.getZoom() + 2 });
            }
          };

          map.on('click', LAYER_CLUSTERS_ID, onClusterClick);
          map.on('click', LAYER_CLUSTER_COUNT_ID, onClusterClick);

          [LAYER_CLUSTERS_ID, LAYER_CLUSTER_COUNT_ID].forEach((layerId) => {
            map.on('mouseenter', layerId, () => {
              map.getCanvas().style.cursor = 'pointer';
            });
            map.on('mouseleave', layerId, () => {
              map.getCanvas().style.cursor = '';
            });
          });
        }

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

        const nextSelected = selectedBusinessRef.current?.id ?? null;
        const prevSelected = selectedIdRef.current;
        if (prevSelected && prevSelected !== nextSelected) {
          try {
            map.removeFeatureState({ source: SOURCE_GEO_ID, id: prevSelected });
          } catch {
            // fuente aún no tiene esa feature
          }
          try {
            map.removeFeatureState({
              source: MVT_SOURCE_ID,
              id: prevSelected,
              sourceLayer: 'businesses'
            });
          } catch {
            // tile aún no tiene esa feature
          }
        }
        if (nextSelected) {
          try {
            map.setFeatureState({ source: SOURCE_GEO_ID, id: nextSelected }, { selected: true });
          } catch {
            // ignore
          }
          try {
            map.setFeatureState(
              { source: MVT_SOURCE_ID, id: nextSelected, sourceLayer: 'businesses' },
              { selected: true }
            );
          } catch {
            // ignore
          }
        }
        selectedIdRef.current = nextSelected;
      } catch (setupErr) {
        console.error('setupLayers failed:', setupErr);
      }
    };

    setupLayersRef.current = setupLayers;

    if (!map) return;

    const attempt = async () => {
      for (let i = 0; i < 3; i++) {
        try {
          await setupLayers();
        } catch (err) {
          console.error('setupLayers failed:', err);
        }
        const complete =
          map.getSource(MVT_SOURCE_ID) &&
          map.getSource(SOURCE_GEO_ID) &&
          map.getLayer(LAYER_MVT_PINS_ID) &&
          map.getLayer(LAYER_GEO_PINS_ID) &&
          map.getLayer(LAYER_CLUSTERS_ID) &&
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

  // Selección: halo + feature-state en ambos sources
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    void setupLayersRef.current?.();
  }, [selectedBusiness]);

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
          'circle-color': COLOR_TRANSFER_ACTIVE,
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
          'line-color': COLOR_CERULEAN,
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
          'circle-color': COLOR_TRANSFER_ACTIVE,
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
                ${esc(p?.code ?? '')}${p?.fare != null ? ` · $${Math.round(Number(p?.fare))} CUP` : ''}
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
            'line-color': COLOR_CERULEAN,
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
