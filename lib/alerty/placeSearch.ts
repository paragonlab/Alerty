/**
 * Búsqueda de lugares (plazas, restaurantes, hospitales…) con Photon, el
 * buscador abierto sobre OpenStreetMap, solo dentro de Culiacán. Es un
 * servicio público de uso justo: se consulta desde 3 letras y con pausa entre
 * teclas. Si Pulso crece, conviene uno propio o de paga.
 */
const PHOTON_URL = "https://photon.komoot.io/api/";
// oeste, sur, este, norte
const CULIACAN_BBOX = "-107.52,24.70,-107.30,24.88";

export type PlaceResult = {
  name: string;
  detail: string;
  lat: number;
  lng: number;
  kind: string;
};

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    street?: string;
    district?: string;
    locality?: string;
    osm_key?: string;
    osm_value?: string;
  };
};

export async function searchCuliacanPlaces(
  query: string,
  signal?: AbortSignal,
): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const params = new URLSearchParams({
    q,
    lat: "24.8091",
    lon: "-107.394",
    limit: "6",
    bbox: CULIACAN_BBOX,
  });
  const res = await fetch(`${PHOTON_URL}?${params}`, { signal });
  if (!res.ok) return [];
  const data = (await res.json()) as { features?: PhotonFeature[] };

  const seen = new Set<string>();
  const out: PlaceResult[] = [];
  for (const f of data.features ?? []) {
    const p = f.properties;
    if (!p.name) continue;
    const key = p.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const [lng, lat] = f.geometry.coordinates;
    out.push({
      name: p.name,
      detail: p.street ?? p.district ?? p.locality ?? "Culiacán",
      lat,
      lng,
      kind: p.osm_value ?? p.osm_key ?? "",
    });
  }
  return out;
}

/** Ícono según el tipo de lugar de OpenStreetMap. */
export function placeIcon(kind: string): string {
  if (/mall|commercial|supermarket|department_store|marketplace|shop/.test(kind)) return "storefront-outline";
  if (/restaurant|fast_food|cafe|bar|pub|food_court/.test(kind)) return "restaurant-outline";
  if (/hospital|clinic|doctors|pharmacy/.test(kind)) return "medkit-outline";
  if (/university|college|school|kindergarten/.test(kind)) return "school-outline";
  if (/hotel|motel/.test(kind)) return "bed-outline";
  if (/stadium|sports|pitch/.test(kind)) return "football-outline";
  if (/park|garden/.test(kind)) return "leaf-outline";
  return "location-outline";
}
