/**
 * Catálogo mínimo de ciudades para edge functions (fase 1).
 * IDs alineados con lib/alerty/city.ts y la migración
 * 20261008180000_cities_and_city_id.sql.
 */

export const CITY_IDS = {
  culiacan: "c0a1c000-0001-4000-8000-000000000001",
  mazatlan: "c0a1c000-0002-4000-8000-000000000002",
} as const;

/** Sync X/RSS fase 1: todo lo nuevo se estampa como Culiacán. */
export const DEFAULT_SYNC_CITY_ID = CITY_IDS.culiacan;

export const CITY_NAMES: Record<string, string> = {
  [CITY_IDS.culiacan]: "Culiacán",
  [CITY_IDS.mazatlan]: "Mazatlán",
};

export function cityName(cityId: string | null | undefined): string {
  if (!cityId) return CITY_NAMES[CITY_IDS.culiacan]!;
  return CITY_NAMES[cityId] ?? CITY_NAMES[CITY_IDS.culiacan]!;
}
