import { useState, useMemo, useCallback } from 'react';
import { CUBAN_PROVINCES } from '@/lib/cuba-data';

export interface FiltersState {
  searchQuery: string;
  selectedProvince: string;
  selectedMunicipality: string;
  selectedCategory: string;
  onlyTransfer: boolean;
  onlyActiveNow: boolean;
  filterVerification: string;
  filterQr: boolean;
  filterOnline: boolean;
  setSearchQuery: (q: string) => void;
  setSelectedProvince: (p: string) => void;
  setSelectedMunicipality: (m: string) => void;
  setSelectedCategory: (c: string) => void;
  setOnlyTransfer: (v: boolean) => void;
  setOnlyActiveNow: (v: boolean) => void;
  setFilterVerification: (v: string) => void;
  setFilterQr: (v: boolean) => void;
  setFilterOnline: (v: boolean) => void;
  hasActiveFilters: boolean;
  handleProvinceChange: (provinceName: string) => void;
  handleResetFilters: () => void;
}

export function useFilters(
  centerOn: (lat: number, lng: number, zoom: number) => void,
  showToast: (msg: string) => void
): FiltersState {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvince, setSelectedProvince] = useState('La Habana');
  const [selectedMunicipality, setSelectedMunicipality] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [onlyTransfer, setOnlyTransfer] = useState(true);
  const [onlyActiveNow, setOnlyActiveNow] = useState(false);
  const [filterVerification, setFilterVerification] = useState('all');
  const [filterQr, setFilterQr] = useState(false);
  const [filterOnline, setFilterOnline] = useState(false);

  const hasActiveFilters = useMemo(
    () =>
      selectedCategory !== 'all' ||
      selectedProvince !== 'La Habana' ||
      selectedMunicipality !== 'all' ||
      onlyActiveNow ||
      !onlyTransfer ||
      filterQr ||
      filterOnline ||
      filterVerification !== 'all' ||
      searchQuery.trim() !== '',
    [selectedCategory, selectedProvince, selectedMunicipality, onlyActiveNow, onlyTransfer, filterQr, filterOnline, filterVerification, searchQuery]
  );

  const handleProvinceChange = useCallback(
    (provinceName: string) => {
      setSelectedProvince(provinceName);
      setSelectedMunicipality('all');
      if (provinceName === 'all') {
        centerOn(21.8, -79.5, 7);
        showToast('\u{1F1F2}\u{1F1FD} Toda la Rep\u00fablica de Cuba');
      } else {
        const pData = CUBAN_PROVINCES.find((p) => p.name === provinceName);
        if (pData) {
          centerOn(pData.center[0], pData.center[1], pData.zoom);
          showToast(`\u{1F4CD} Vista centrada en ${provinceName}`);
        }
      }
    },
    [centerOn, showToast]
  );

  const handleResetFilters = useCallback(() => {
    setSelectedProvince('La Habana');
    setSelectedMunicipality('all');
    setSelectedCategory('all');
    setOnlyActiveNow(false);
    setOnlyTransfer(true);
    setFilterVerification('all');
    setFilterQr(false);
    setFilterOnline(false);
    setSearchQuery('');
    centerOn(23.1385, -82.3842, 14);
    showToast('Filtros restablecidos');
  }, [centerOn, showToast]);

  return {
    searchQuery, selectedProvince, selectedMunicipality, selectedCategory,
    onlyTransfer, onlyActiveNow, filterVerification, filterQr, filterOnline,
    setSearchQuery, setSelectedProvince, setSelectedMunicipality, setSelectedCategory,
    setOnlyTransfer, setOnlyActiveNow, setFilterVerification, setFilterQr, setFilterOnline,
    hasActiveFilters, handleProvinceChange, handleResetFilters
  };
}
