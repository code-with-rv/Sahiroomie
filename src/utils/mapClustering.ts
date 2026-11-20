import type { Listing } from '../types/sahiroomie';

export const MAP_TILE_URLS = {
  street:
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
  satellite:
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  satelliteLabels:
    'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
} as const;

export const MAP_TILE_ATTRIBUTIONS = {
  street: 'Tiles &copy; Esri &mdash; Source: Esri, HERE, Garmin, USGS, OpenStreetMap contributors',
  satellite: 'Tiles &copy; Esri &mdash; World Imagery',
} as const;

export interface SinglePinMarker {
  kind: 'single';
  id: string;
  listing: Listing;
  lat: number;
  lng: number;
}

export interface CityClusterMarker {
  kind: 'cluster';
  id: string;
  city: string;
  lat: number;
  lng: number;
  count: number;
  minRent: number;
  listings: Listing[];
}

export type MapRenderMarker = SinglePinMarker | CityClusterMarker;

/**
 * Pure zoom-aware grouping for live map listings:
 * - At regional / national zooms (zoom <= 7), groups multiple listings in the same city
 *   into a single non-overlapping city cluster pill (e.g. "3 · ₹8.5k+").
 * - At metro / neighborhood zooms (zoom > 7), returns every listing at its exact coordinates.
 */
export function buildMapMarkers(listings: Listing[], zoom: number): MapRenderMarker[] {
  const valid = listings.filter(
    (l) => typeof l.lat === 'number' && Number.isFinite(l.lat) && typeof l.lng === 'number' && Number.isFinite(l.lng)
  );

  if (zoom > 7) {
    return valid.map((listing) => ({
      kind: 'single',
      id: listing.id,
      listing,
      lat: listing.lat,
      lng: listing.lng,
    }));
  }

  const byCity = new Map<string, Listing[]>();
  for (const listing of valid) {
    const key = listing.city || 'Other';
    const arr = byCity.get(key);
    if (arr) {
      arr.push(listing);
    } else {
      byCity.set(key, [listing]);
    }
  }

  const markers: MapRenderMarker[] = [];
  for (const [city, group] of byCity.entries()) {
    if (group.length === 1) {
      const only = group[0];
      markers.push({
        kind: 'single',
        id: only.id,
        listing: only,
        lat: only.lat,
        lng: only.lng,
      });
      continue;
    }

    const avgLat = group.reduce((sum, item) => sum + item.lat, 0) / group.length;
    const avgLng = group.reduce((sum, item) => sum + item.lng, 0) / group.length;
    const minRent = Math.min(...group.map((item) => item.rent));

    markers.push({
      kind: 'cluster',
      id: `cluster-${city}`,
      city,
      lat: Number(avgLat.toFixed(5)),
      lng: Number(avgLng.toFixed(5)),
      count: group.length,
      minRent,
      listings: group,
    });
  }

  return markers;
}
