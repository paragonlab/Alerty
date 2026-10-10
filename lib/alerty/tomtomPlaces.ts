/**
 * Autocomplete de lugares vía edge tomtom-places (key de servidor oculta).
 */
import { supabase } from "../supabase";
import type { TripPlace } from "./travel/tripPlaces";

const MOCK: TripPlace[] = [
  { name: "Culiacán, Sinaloa", lat: 24.8091, lng: -107.394, municipality: "Culiacán" },
  { name: "Mazatlán, Sinaloa", lat: 23.2494, lng: -106.4111, municipality: "Mazatlán" },
  { name: "Los Mochis, Sinaloa", lat: 25.7903, lng: -108.9859, municipality: "Ahome" },
  { name: "Tepic, Nayarit", lat: 21.5041, lng: -104.8946, municipality: "Tepic" },
  { name: "Guadalajara, Jalisco", lat: 20.6597, lng: -103.3496, municipality: "Guadalajara" },
];

export async function searchTripPlaces(query: string): Promise<TripPlace[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  if (!supabase) {
    const ql = q.toLowerCase();
    return MOCK.filter((p) => p.name.toLowerCase().includes(ql)).slice(0, 6);
  }
  try {
    const { data, error } = await supabase.functions.invoke("tomtom-places", {
      body: { q },
    });
    if (error || !data) {
      return MOCK.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())).slice(
        0,
        6,
      );
    }
    const results = (data as { results?: TripPlace[] }).results;
    return Array.isArray(results) ? results : [];
  } catch {
    return MOCK.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())).slice(
      0,
      6,
    );
  }
}
