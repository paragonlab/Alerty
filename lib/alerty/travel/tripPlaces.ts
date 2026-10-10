/**
 * Lugares y viajes recientes para Modo viaje (origen/destino libres).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export type TripPlace = {
  name: string;
  lat: number;
  lng: number;
  municipality?: string | null;
};

export type RecentTrip = {
  origin: TripPlace;
  destination: TripPlace;
  savedAt: string;
};

export const RECENT_TRIPS_KEY = "pulso_recent_trips_v1";
export const MAX_RECENT_TRIPS = 6;

/** Chips rápidos (mismas coords que el edge). */
export const TRIP_ROUTE_CHIPS = [
  {
    id: "culiacan_mazatlan",
    label: "Culiacán – Mazatlán",
    origin: { name: "Culiacán", lat: 24.8091, lng: -107.394 },
    destination: { name: "Mazatlán", lat: 23.2494, lng: -106.4111 },
  },
  {
    id: "culiacan_los_mochis",
    label: "Culiacán – Los Mochis",
    origin: { name: "Culiacán", lat: 24.8091, lng: -107.394 },
    destination: { name: "Los Mochis", lat: 25.7903, lng: -108.9859 },
  },
  {
    id: "mazatlan_tepic",
    label: "Mazatlán – Tepic",
    origin: { name: "Mazatlán", lat: 23.2494, lng: -106.4111 },
    destination: { name: "Tepic", lat: 21.5041, lng: -104.8946 },
  },
  {
    id: "culiacan_guadalajara",
    label: "Culiacán – Guadalajara",
    origin: { name: "Culiacán", lat: 24.8091, lng: -107.394 },
    destination: { name: "Guadalajara", lat: 20.6597, lng: -103.3496 },
  },
] as const;

export function isMex15dChip(origin: TripPlace, destination: TripPlace): boolean {
  const near = (a: TripPlace, b: { lat: number; lng: number }) => {
    const dlat = a.lat - b.lat;
    const dlng = a.lng - b.lng;
    return Math.sqrt(dlat * dlat + dlng * dlng) < 0.25;
  };
  const cul = { lat: 24.8091, lng: -107.394 };
  const mzt = { lat: 23.2494, lng: -106.4111 };
  return (
    (near(origin, cul) && near(destination, mzt)) ||
    (near(origin, mzt) && near(destination, cul))
  );
}

export function travelDirectionFromTrip(
  origin: TripPlace,
  destination: TripPlace,
): "culiacan_to_mazatlan" | "mazatlan_to_culiacan" | null {
  if (!isMex15dChip(origin, destination)) return null;
  return origin.lat > destination.lat
    ? "culiacan_to_mazatlan"
    : "mazatlan_to_culiacan";
}

export async function loadRecentTrips(): Promise<RecentTrip[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_TRIPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentTrip[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (t) =>
        t?.origin?.name &&
        t?.destination?.name &&
        Number.isFinite(t.origin.lat) &&
        Number.isFinite(t.destination.lat),
    ).slice(0, MAX_RECENT_TRIPS);
  } catch {
    return [];
  }
}

export async function saveRecentTrip(
  origin: TripPlace,
  destination: TripPlace,
): Promise<RecentTrip[]> {
  const next: RecentTrip = {
    origin,
    destination,
    savedAt: new Date().toISOString(),
  };
  const prev = await loadRecentTrips();
  const filtered = prev.filter(
    (t) =>
      !(
        Math.abs(t.origin.lat - origin.lat) < 0.01 &&
        Math.abs(t.origin.lng - origin.lng) < 0.01 &&
        Math.abs(t.destination.lat - destination.lat) < 0.01 &&
        Math.abs(t.destination.lng - destination.lng) < 0.01
      ),
  );
  const list = [next, ...filtered].slice(0, MAX_RECENT_TRIPS);
  try {
    await AsyncStorage.setItem(RECENT_TRIPS_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
  return list;
}

export function swapTrip(
  origin: TripPlace | null,
  destination: TripPlace | null,
): { origin: TripPlace | null; destination: TripPlace | null } {
  return { origin: destination, destination: origin };
}
