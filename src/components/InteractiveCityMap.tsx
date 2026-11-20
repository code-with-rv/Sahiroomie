import L from 'leaflet';
import React, { useEffect, useRef, useState } from 'react';
import { CITIES_DATA, getLocalizedCityLabel } from '../data/seedData';
import type { Language, Listing } from '../types/sahiroomie';
import { formatCompactINR, formatINR } from '../utils/compatibility';
import {
  MAP_TILE_ATTRIBUTIONS,
  MAP_TILE_URLS,
  buildMapMarkers,
} from '../utils/mapClustering';
import { Icon } from './Icon';

interface InteractiveCityMapProps {
  listings: Listing[];
  selectedCity: string;
  onSelectCity: (cityId: string) => void;
  selectedPinId: string | null;
  onSelectPin: (id: string) => void;
  darkMode: boolean;
  lang: Language;
}

type MapStyleMode = 'street' | 'satellite';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const InteractiveCityMap: React.FC<InteractiveCityMapProps> = ({
  listings,
  selectedCity,
  onSelectCity,
  selectedPinId,
  onSelectPin,
  darkMode,
  lang,
}) => {
  const [mapMode, setMapMode] = useState<MapStyleMode>('street');
  const [locating, setLocating] = useState(false);
  const [currentZoom, setCurrentZoom] = useState<number>(() => {
    if (selectedCity === 'All India') return 5;
    const cityMeta = CITIES_DATA.find((c) => c.id === selectedCity) || CITIES_DATA[0];
    return cityMeta.zoom || 12;
  });

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseLayersRef = useRef<L.TileLayer[]>([]);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const privacyCircleRef = useRef<L.Circle | null>(null);
  const userLocationRef = useRef<L.CircleMarker | null>(null);
  const onSelectPinRef = useRef(onSelectPin);
  const onSelectCityRef = useRef(onSelectCity);

  useEffect(() => {
    onSelectPinRef.current = onSelectPin;
  }, [onSelectPin]);

  useEffect(() => {
    onSelectCityRef.current = onSelectCity;
  }, [onSelectCity]);

  // Initialize Leaflet map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const initialCity = CITIES_DATA.find((c) => c.id === selectedCity) || CITIES_DATA[0];
    const center: [number, number] =
      selectedCity === 'All India'
        ? [21.1458, 79.0882]
        : [initialCity.lat, initialCity.lng];
    const initialZoom = selectedCity === 'All India' ? 5 : initialCity.zoom || 12;

    const map = L.map(mapContainerRef.current, {
      center,
      zoom: initialZoom,
      zoomControl: false,
      attributionControl: true,
      preferCanvas: false,
    });

    map.attributionControl.setPrefix(false);
    map.attributionControl.setPosition('bottomleft');

    markersLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const handleZoomEnd = () => {
      setCurrentZoom(Math.round(map.getZoom()));
    };
    map.on('zoomend', handleZoomEnd);

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      map.off('zoomend', handleZoomEnd);
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      baseLayersRef.current = [];
      markersLayerRef.current = null;
      privacyCircleRef.current = null;
      userLocationRef.current = null;
    };
  }, []);

  // Swap Street vs Satellite keyless tile layers cleanly without blank flash
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const previousLayers = [...baseLayersRef.current];
    const nextLayers: L.TileLayer[] = [];

    if (mapMode === 'satellite') {
      const imagery = L.tileLayer(MAP_TILE_URLS.satellite, {
        attribution: MAP_TILE_ATTRIBUTIONS.satellite,
        maxZoom: 18,
        zIndex: 1,
      }).addTo(map);
      const labels = L.tileLayer(MAP_TILE_URLS.satelliteLabels, {
        maxZoom: 18,
        opacity: 0.92,
        zIndex: 2,
      }).addTo(map);
      nextLayers.push(imagery, labels);
    } else {
      const street = L.tileLayer(MAP_TILE_URLS.street, {
        attribution: MAP_TILE_ATTRIBUTIONS.street,
        maxZoom: 18,
        zIndex: 1,
      }).addTo(map);
      nextLayers.push(street);
    }

    baseLayersRef.current = nextLayers;

    const primaryNext = nextLayers[0];
    let cleanedUp = false;
    const removeOldLayers = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      for (const layer of previousLayers) {
        if (map.hasLayer(layer)) {
          map.removeLayer(layer);
        }
      }
    };

    if (previousLayers.length > 0 && primaryNext) {
      primaryNext.once('load', removeOldLayers);
      const fallbackTimer = window.setTimeout(removeOldLayers, 3500);
      return () => {
        window.clearTimeout(fallbackTimer);
        primaryNext.off('load', removeOldLayers);
      };
    }
  }, [mapMode]);

  // Smoothly fly/fit map whenever selectedCity changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (selectedCity === 'All India') {
      setCurrentZoom(5);
      const coords = listings
        .filter((l) => typeof l.lat === 'number' && typeof l.lng === 'number')
        .map((l) => [l.lat, l.lng] as [number, number]);
      if (coords.length >= 2) {
        map.fitBounds(L.latLngBounds(coords), { padding: [70, 70], maxZoom: 6, animate: true });
      } else {
        map.flyTo([21.1458, 79.0882], 5, { duration: 0.6 });
      }
      return;
    }

    const cityMeta = CITIES_DATA.find((c) => c.id === selectedCity) || CITIES_DATA[0];
    const targetZoom = cityMeta.zoom || 12;
    setCurrentZoom(targetZoom);
    map.flyTo([cityMeta.lat, cityMeta.lng], targetZoom, { duration: 0.55 });
  }, [selectedCity]);

  // Render live listing price pins (or non-overlapping city clusters at low zoom) & 1 km halo
  useEffect(() => {
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    if (privacyCircleRef.current) {
      map.removeLayer(privacyCircleRef.current);
      privacyCircleRef.current = null;
    }

    const effectiveZoom = selectedCity === 'All India' ? Math.min(currentZoom, 7) : currentZoom;
    const renderMarkers = buildMapMarkers(listings, effectiveZoom);

    renderMarkers.forEach((item) => {
      if (item.kind === 'cluster') {
        const minCompact = escapeHtml(formatCompactINR(item.minRent));
        const ariaLabel = `${item.city}: ${item.count} live listings starting at ${formatINR(item.minRent)} per month`;
        const icon = L.divIcon({
          className: 'sahi-leaflet-pin-wrapper',
          html: `<span style="
            display:inline-flex;align-items:center;justify-content:center;gap:4px;white-space:nowrap;
            padding:5px 10px;border-radius:9999px;font-weight:800;font-size:12px;
            font-family:'JetBrains Mono',monospace;cursor:pointer;
            background:#4F46E5;color:#FFFFFF;border:2px solid #FFFFFF;
            box-shadow:0 6px 16px rgba(79,70,229,0.36);
          ">${item.count} · ${minCompact}+</span>`,
          iconSize: [96, 30],
          iconAnchor: [48, 30],
        });

        const marker = L.marker([item.lat, item.lng], {
          icon,
          title: ariaLabel,
          alt: ariaLabel,
          zIndexOffset: 250,
        });

        marker.on('add', () => {
          const el = marker.getElement();
          if (el) el.setAttribute('aria-label', ariaLabel);
        });

        marker.on('click', () => {
          onSelectCityRef.current(item.city);
        });

        marker.addTo(layer);
        return;
      }

      const listing = item.listing;
      const isSelected = selectedPinId === listing.id;
      const compactPrice = escapeHtml(formatCompactINR(listing.rent));
      const ariaLabel = `${listing.area} ${formatINR(listing.rent)} per month`;
      const bgColor = isSelected ? '#4F46E5' : darkMode ? '#0F172A' : '#FFFFFF';
      const textColor = isSelected ? '#FFFFFF' : darkMode ? '#F8FAFC' : '#0F172A';
      const borderColor = isSelected ? '#FFFFFF' : darkMode ? '#334155' : '#0F172A';
      const ringShadow = isSelected
        ? '0 0 0 4px rgba(79,70,229,0.32), 0 8px 18px rgba(15,23,42,0.28)'
        : '0 4px 12px rgba(15,23,42,0.22)';

      const icon = L.divIcon({
        className: 'sahi-leaflet-pin-wrapper',
        html: `<span style="
          display:inline-flex;align-items:center;justify-content:center;gap:4px;white-space:nowrap;
          padding:5px 11px;border-radius:9999px;font-weight:800;font-size:12px;
          font-family:'JetBrains Mono',monospace;cursor:pointer;
          background:${bgColor};color:${textColor};border:2px solid ${borderColor};
          box-shadow:${ringShadow};transform:${isSelected ? 'scale(1.08)' : 'scale(1)'};
          transition:transform 140ms ease,background-color 140ms ease;
        ">${compactPrice}</span>`,
        iconSize: [74, 30],
        iconAnchor: [37, 30],
      });

      const marker = L.marker([listing.lat, listing.lng], {
        icon,
        title: ariaLabel,
        alt: ariaLabel,
        zIndexOffset: isSelected ? 600 : 100,
      });

      marker.on('add', () => {
        const el = marker.getElement();
        if (el) el.setAttribute('aria-label', ariaLabel);
      });

      marker.on('click', () => {
        onSelectPinRef.current(listing.id);
        map.panTo([listing.lat, listing.lng], { animate: true });
      });

      marker.addTo(layer);

      if (isSelected) {
        privacyCircleRef.current = L.circle([listing.lat, listing.lng], {
          radius: 1000,
          color: '#4F46E5',
          weight: 2,
          dashArray: '6 5',
          fillColor: '#4F46E5',
          fillOpacity: 0.14,
          interactive: false,
        }).addTo(map);
      }
    });
  }, [listings, selectedPinId, darkMode, currentZoom, selectedCity]);

  const handleLocateMe = () => {
    const map = mapRef.current;
    if (!map || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        if (userLocationRef.current) {
          map.removeLayer(userLocationRef.current);
        }
        userLocationRef.current = L.circleMarker(coords, {
          radius: 8,
          color: '#FFFFFF',
          weight: 3,
          fillColor: '#2563EB',
          fillOpacity: 1,
        }).addTo(map);
        map.flyTo(coords, 14, { duration: 0.7 });
      },
      () => {
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 6000 }
    );
  };

  return (
    <div
      className={`relative w-full h-full overflow-hidden select-none ${
        mapMode === 'street' ? 'sahi-street-map' : ''
      }`}
      style={{ backgroundColor: 'var(--map-bg)' }}
    >
      {/* Keep mapContainerRef className static so React never wipes Leaflet's runtime leaflet-container classes */}
      <div ref={mapContainerRef} className="w-full h-full isolate z-0" />

      {/* City Switcher Pills */}
      <div
        data-map-control="true"
        className="absolute top-[68px] lg:top-[74px] left-3 right-3 z-20 flex items-center gap-1.5 overflow-x-auto no-scrollbar pr-4"
      >
        {['All India', ...CITIES_DATA.map((c) => c.id)].map((cityId) => {
          const active = selectedCity === cityId;
          const label = getLocalizedCityLabel(cityId, lang);
          return (
            <button
              key={cityId}
              type="button"
              onClick={() => onSelectCity(cityId)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shadow-sm border shrink-0"
              style={{
                backgroundColor: active ? '#4F46E5' : 'var(--bg)',
                color: active ? '#FFFFFF' : 'var(--text-primary)',
                borderColor: active ? '#4F46E5' : 'var(--border)',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Right Map Controls: Satellite Toggle, Locate Me, Zoom */}
      <div
        data-map-control="true"
        className="absolute right-3 top-[116px] lg:top-[122px] z-20 flex flex-col items-end gap-2"
      >
        <button
          type="button"
          onClick={() => setMapMode((m) => (m === 'street' ? 'satellite' : 'street'))}
          className="px-3 h-9 rounded-full shadow-md border text-[11px] font-bold flex items-center gap-1.5 whitespace-nowrap"
          style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
          aria-label={mapMode === 'street' ? 'Switch to Satellite map view' : 'Switch to Street map view'}
        >
          <Icon name="map" size={14} className="text-[#4F46E5]" />
          <span>{mapMode === 'street' ? 'Satellite' : 'Street'}</span>
        </button>

        <div
          className="flex flex-col rounded-2xl overflow-hidden shadow-md border"
          style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
        >
          <button
            type="button"
            onClick={() => mapRef.current?.zoomIn()}
            className="w-11 h-11 flex items-center justify-center font-bold text-lg border-b active:opacity-70"
            style={{ borderColor: 'var(--border)' }}
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => mapRef.current?.zoomOut()}
            className="w-11 h-11 flex items-center justify-center font-bold text-lg border-b active:opacity-70"
            style={{ borderColor: 'var(--border)' }}
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            onClick={handleLocateMe}
            disabled={locating}
            className="w-11 h-11 flex items-center justify-center active:opacity-70 disabled:opacity-50"
            aria-label="Center map on my location"
            title="My location"
          >
            <Icon name="pin" size={17} className="text-[#4F46E5]" />
          </button>
        </div>
      </div>
    </div>
  );
};
