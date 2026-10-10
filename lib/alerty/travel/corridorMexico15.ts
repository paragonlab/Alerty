/**
 * Corredor estático México 15 / 15D (Culiacán ↔ Mazatlán).
 *
 * MVP sin routing API: polilíneas aproximadas de la libre (15) y la cuota (15D).
 * Coordenadas en WGS84; precisión de tramo (no GPS de usuario).
 * Para enchufar routing después: ver resolveCorridor() en travelMode.ts.
 */

export type LatLng = { latitude: number; longitude: number };

/** GeoJSON FeatureCollection (exportable). */
export const MEXICO_15_CORRIDOR_GEOJSON = {
  type: "FeatureCollection" as const,
  name: "mexico-15-15d-culiacan-mazatlan",
  features: [
    {
      type: "Feature" as const,
      properties: {
        id: "mex15-libre",
        name: "México 15 (libre)",
        highway: "MX-15",
        toll: false,
      },
      geometry: {
        type: "LineString" as const,
        /** [lng, lat] */
        coordinates: [
          [-107.394, 24.8091],
          [-107.418, 24.74],
          [-107.445, 24.65],
          [-107.455, 24.55],
          [-107.44, 24.45],
          [-107.4, 24.35],
          [-107.32, 24.22],
          [-107.18, 24.08],
          [-107.02, 23.95],
          [-106.88, 23.82],
          [-106.72, 23.65],
          [-106.58, 23.48],
          [-106.45, 23.32],
          [-106.4111, 23.2494],
        ],
      },
    },
    {
      type: "Feature" as const,
      properties: {
        id: "mex15d-cuota",
        name: "México 15D (cuota)",
        highway: "MX-15D",
        toll: true,
      },
      geometry: {
        type: "LineString" as const,
        coordinates: [
          [-107.394, 24.8091],
          [-107.43, 24.72],
          [-107.46, 24.62],
          [-107.47, 24.52],
          [-107.45, 24.4],
          [-107.38, 24.28],
          [-107.28, 24.14],
          [-107.12, 24.0],
          [-106.95, 23.88],
          [-106.78, 23.72],
          [-106.62, 23.55],
          [-106.48, 23.38],
          [-106.35, 23.26],
          [-106.4111, 23.2494],
        ],
      },
    },
  ],
};

function lineToLatLng(coords: number[][]): LatLng[] {
  return coords.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
}

/** Polilíneas listas para MapView (ambas vías). */
export function getMexico15CorridorLines(): { id: string; name: string; coordinates: LatLng[] }[] {
  return MEXICO_15_CORRIDOR_GEOJSON.features.map((f) => ({
    id: f.properties.id,
    name: f.properties.name,
    coordinates: lineToLatLng(f.geometry.coordinates),
  }));
}

/** Una sola polilínea “bundle” (cuota + muestreo de libre) para buffer/cámara. */
export function getMexico15BundleCoordinates(): LatLng[] {
  const lines = getMexico15CorridorLines();
  const cuota = lines.find((l) => l.id === "mex15d-cuota")?.coordinates ?? [];
  const libre = lines.find((l) => l.id === "mex15-libre")?.coordinates ?? [];
  // Alterna puntos para que el buffer cubra ambas calzadas sin duplicar extremos.
  const out: LatLng[] = [];
  const n = Math.max(cuota.length, libre.length);
  for (let i = 0; i < n; i++) {
    if (i < cuota.length) out.push(cuota[i]);
    if (i < libre.length && i % 2 === 1) out.push(libre[i]);
  }
  return out.length ? out : cuota;
}

export function corridorBoundingRegion(coords: LatLng[]): {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
} {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const c of coords) {
    minLat = Math.min(minLat, c.latitude);
    maxLat = Math.max(maxLat, c.latitude);
    minLng = Math.min(minLng, c.longitude);
    maxLng = Math.max(maxLng, c.longitude);
  }
  const pad = 0.08;
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.25, maxLat - minLat + pad),
    longitudeDelta: Math.max(0.25, maxLng - minLng + pad),
  };
}
