import { useState, useCallback } from 'react';
import type { Map as MaplibreMap } from 'maplibre-gl';
import type { Business } from '@/lib/cuba-data';
import { calculateOSRMRoute, OSRMRouteResult } from '@/lib/osrm';
import type { ClusterInfo } from '@/components/MapLibreMap';

interface UseBusinessActionsParams {
  setBusinesses: React.Dispatch<React.SetStateAction<Business[]>>;
  syncMutation: (id: string, action: string, payload?: Record<string, unknown>) => void;
  applyToStates: (bizId: string, transform: (b: Business) => Business, remove?: boolean) => void;
  userLocation: { lat: number; lng: number } | null;
  setUserLocation: (c: { lat: number; lng: number } | null) => void;
  setUserLocationName: (n: string) => void;
  centerOn: (lat: number, lng: number, zoom: number) => void;
  mapRef: React.MutableRefObject<MaplibreMap | null>;
  showToast: (msg: string) => void;
}

export function useBusinessActions({
  setBusinesses, syncMutation, applyToStates,
  userLocation, setUserLocation, setUserLocationName,
  centerOn, mapRef, showToast
}: UseBusinessActionsParams) {
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [activeRoute, setActiveRoute] = useState<{ route: OSRMRouteResult; business: Business } | null>(null);
  const [clusterView, setClusterView] = useState<ClusterInfo | null>(null);
  const [clusterVisibleCount, setClusterVisibleCount] = useState(8);

  const handleSelectBusiness = useCallback((business: Business | null) => {
    setSelectedBusiness(business);
    setClusterView(null);
    if (business) {
      centerOn(business.lat, business.lng, 16);
    }
  }, [centerOn]);

  const handleSelectSearchBusiness = useCallback((b: Business) => {
    handleSelectBusiness(b);
  }, [handleSelectBusiness]);

  const handleCalculateRoute = useCallback(async (targetBiz: Business) => {
    let origin = userLocation;
    if (!origin) {
      origin = { lat: 23.1385, lng: -82.3842 };
      setUserLocation(origin);
      setUserLocationName('Vedado, La Habana (Referencia GPS)');
    }
    showToast(`\u{1F697} Calculando ruta OSRM hacia ${targetBiz.name}...`);
    try {
      const result = await calculateOSRMRoute(origin, { lat: targetBiz.lat, lng: targetBiz.lng });
      if (result) {
        setActiveRoute({ route: result, business: targetBiz });
        showToast(`\u2713 Ruta calculada: ${(result.distanceMeters / 1000).toFixed(1)} km`);
      } else {
        showToast('No se pudo trazar la ruta en este momento.');
      }
    } catch {
      showToast('Error al conectar con el servidor OSRM.');
    }
  }, [userLocation, setUserLocation, setUserLocationName, showToast]);

  const handleVote = useCallback((bizId: string, isConfirm: boolean) => {
    setBusinesses((prev) =>
      prev.map((b) => {
        if (b.id === bizId) {
          return {
            ...b,
            confirmationsCount: isConfirm ? b.confirmationsCount + 1 : b.confirmationsCount,
            reportsCount: !isConfirm ? b.reportsCount + 1 : b.reportsCount,
            lastStatusUpdate: 'Confirmado recientemente'
          };
        }
        return b;
      })
    );
    void syncMutation(bizId, 'vote', { isConfirm });
    showToast(isConfirm ? '\u2713 Voto registrado: Confirmado activo hoy' : 'Reporte registrado para moderaci\u00f3n');
  }, [setBusinesses, syncMutation, showToast]);

  const handleToggleTransferActive = useCallback((bizId: string) => {
    setBusinesses((prev) =>
      prev.map((b) => {
        if (b.id === bizId) {
          const newStatus = !b.transferActiveNow;
          return {
            ...b,
            transferActiveNow: newStatus,
            lastStatusUpdate: 'Hace un momento'
          };
        }
        return b;
      })
    );
    setSelectedBusiness((prev) =>
      prev && prev.id === bizId
        ? { ...prev, transferActiveNow: !prev.transferActiveNow, lastStatusUpdate: 'Hace un momento' }
        : prev
    );
    void syncMutation(bizId, 'toggleTransferActive');
    showToast('Estado de transferencia en vivo actualizado');
  }, [setBusinesses, syncMutation, showToast]);

  const handleReport = useCallback((bizId: string, reason: string) => {
    setBusinesses((prev) =>
      prev.map((b) => (b.id === bizId ? { ...b, reportsCount: b.reportsCount + 1 } : b))
    );
    void syncMutation(bizId, 'report');
    showToast(`\u2713 Reporte enviado al equipo TransferCuba: "${reason.slice(0, 30)}..."`);
  }, [setBusinesses, syncMutation, showToast]);

  const handleRegisterBusiness = useCallback(
    async (data: Partial<Business>, defaultProvince: string, mapCenter: [number, number]) => {
      const localBiz: Business = {
        id: `tc-biz-${Date.now()}`,
        name: data.name || 'Nuevo Negocio',
        category: data.category || 'tiendas',
        categoryIcon: data.categoryIcon || '\u{1F3EA}',
        description: data.description || '',
        province: data.province || defaultProvince,
        municipality: data.municipality || 'Playa',
        neighborhood: data.neighborhood || '',
        address: data.address || '',
        lat: data.lat || mapCenter[0],
        lng: data.lng || mapCenter[1],
        acceptsTransfer: true,
        transferActiveNow: data.transferActiveNow ?? true,
        transferDetails: data.transferDetails || {
          transfermovil: true,
          enzona: false,
          qrPayment: false,
          onlineGateway: false,
          cash: true
        },
        transferVerified: false,
        lastStatusUpdate: 'Registrado hoy (Pendiente de aprobaci\u00f3n)',
        lastUpdatedDate: new Date().toISOString(),
        confirmationsCount: 1,
        reportsCount: 0,
        hours: data.hours || '8:30 AM - 6:00 PM',
        whatsapp: data.whatsapp || '',
        phone: data.phone || '',
        rating: 5.0,
        reviewsCount: 1,
        photos: data.photos ?? [],
        featured: false,
        status: 'pending'
      };

      let createdViaApi = false;
      try {
        const res = await fetch('/api/businesses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(localBiz)
        });
        if (res.ok) {
          const payload = (await res.json()) as { success?: boolean; business?: Business };
          const created = payload.business;
          if (payload.success && created) {
            setBusinesses((prev) => [created, ...prev]);
            createdViaApi = true;
          }
        }
      } catch {
        // offline: cache local
      }
      if (!createdViaApi) setBusinesses((prev) => [localBiz, ...prev]);
      showToast('\u{1F389}\u{2753} \u00A1Negocio recibido! Queda \u{1F7E1} Pendiente de aprobaci\u00f3n por un administrador antes de publicarse.');
    },
    [setBusinesses, showToast]
  );

  // Admin approvals
  const handleApproveBusiness = useCallback((bizId: string) => {
    let bizName = '';
    applyToStates(bizId, (b) => {
      bizName = b.name;
      return {
        ...b,
        status: 'active' as const,
        transferVerified: true,
        lastStatusUpdate: 'Aprobado y publicado por administraci\u00f3n'
      };
    });
    void syncMutation(bizId, 'approve');
    showToast(`\u2713 \u00A1Negocio "${bizName || 'Comercio'}" aprobado y visible en el mapa!`);
  }, [applyToStates, syncMutation, showToast]);

  const handleRejectBusiness = useCallback((bizId: string) => {
    let bizName = '';
    applyToStates(bizId, (b) => {
      bizName = b.name;
      return {
        ...b,
        status: 'rejected' as const,
        lastStatusUpdate: 'Rechazado por administraci\u00f3n'
      };
    });
    void syncMutation(bizId, 'reject');
    showToast(`Negocio "${bizName || 'Comercio'}" rechazado.`);
  }, [applyToStates, syncMutation, showToast]);

  const handleToggleVerify = useCallback((bizId: string) => {
    applyToStates(bizId, (b) => ({
      ...b,
      transferVerified: !b.transferVerified,
      status: !b.transferVerified ? ('active' as const) : ('pending' as const)
    }));
    void syncMutation(bizId, 'verify');
    showToast('Estado de verificaci\u00f3n TransferCuba actualizado');
  }, [applyToStates, syncMutation, showToast]);

  const handleDeleteBusiness = useCallback((bizId: string) => {
    applyToStates(bizId, (b) => b, true);
    void syncMutation(bizId, 'delete');
    setSelectedBusiness((prev) => (prev?.id === bizId ? null : prev));
    showToast('Negocio eliminado');
  }, [applyToStates, syncMutation, showToast]);

  // Cluster handlers
  const handleClusterClick = useCallback((info: ClusterInfo) => {
    setClusterView(info);
    setClusterVisibleCount(8);
  }, []);

  const handleCloseCluster = useCallback(() => {
    setClusterView(null);
    setClusterVisibleCount(8);
  }, []);

  const handleExpandCluster = useCallback(() => {
    const m = mapRef.current;
    if (!m || !clusterView) return;
    const zoom = clusterView.expansionZoom ?? Math.max(m.getZoom() ?? 0, 15);
    m.easeTo({
      center: [clusterView.center[1], clusterView.center[0]],
      zoom,
      duration: 900
    });
    setClusterView(null);
    setClusterVisibleCount(8);
  }, [mapRef, clusterView]);

  return {
    selectedBusiness, setSelectedBusiness, activeRoute, setActiveRoute,
    clusterView, clusterVisibleCount, setClusterVisibleCount,
    handleSelectBusiness, handleSelectSearchBusiness, handleCalculateRoute,
    handleVote, handleToggleTransferActive, handleReport, handleRegisterBusiness,
    handleApproveBusiness, handleRejectBusiness, handleToggleVerify, handleDeleteBusiness,
    handleClusterClick, handleCloseCluster, handleExpandCluster
  };
}