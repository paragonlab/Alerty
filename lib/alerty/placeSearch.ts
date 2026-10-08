/**
 * Búsqueda de lugares (plazas, restaurantes, hospitales…) con Photon, el
 * buscador abierto sobre OpenStreetMap, dentro de la ciudad activa. Es un
 * servicio público de uso justo: se consulta desde 3 letras y con pausa entre
 * teclas. Si Pulso crece, conviene uno propio o de paga.
 */
import { getActiveCity } from "./city";

const PHOTON_URL = "https://photon.komoot.io/api/";

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

/** Alias histórico: busca en la ciudad activa (hoy Culiacán). */
export async function searchCuliacanPlaces(
  query: string,
  signal?: AbortSignal,
): Promise<PlaceResult[]> {
  return searchActiveCityPlaces(query, signal);
}

export async function searchActiveCityPlaces(
  query: string,
  signal?: AbortSignal,
): Promise<PlaceResult[]> {
  const city = getActiveCity();
  const q = query.trim();
  if (q.length < 3) return [];
  const params = new URLSearchParams({
    q,
    lat: String(city.center.latitude),
    lon: String(city.center.longitude),
    limit: "6",
    bbox: city.bbox,
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
      detail: p.street ?? p.district ?? p.locality ?? city.name,
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
