/**
 * Fuente de verdad de la ciudad activa.
 *
 * Default de prod: Culiacán (`ACTIVE_CITY_SLUG`). Preferencia en AsyncStorage,
 * selector de ciudad (mapa / Ajustes) o `?city=` en web. Los IDs coinciden
 * con el seed de supabase/migrations/20261008180000_cities_and_city_id.sql.
 */

export type CitySlug = "culiacan" | "mazatlan";

export type CityConfig = {
  id: string;
  slug: CitySlug;
  name: string;
  state: string;
  /** Región inicial del mapa (MapView). */
  center: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  /** Photon bbox: oeste, sur, este, norte. */
  bbox: string;
  timezone: string;
  /** Ciudad con feed/sync en prod (DB `cities.active`). */
  active: boolean;
};

/** UUID fijo del seed SQL — no regenerar. */
export const CITY_IDS = {
  culiacan: "c0a1c000-0001-4000-8000-000000000001",
  mazatlan: "c0a1c000-0002-4000-8000-000000000002",
} as const;

export const CITIES: Record<CitySlug, CityConfig> = {
  culiacan: {
    id: CITY_IDS.culiacan,
    slug: "culiacan",
    name: "Culiacán",
    state: "Sinaloa",
    center: {
      latitude: 24.8091,
      longitude: -107.394,
      latitudeDelta: 0.16,
      longitudeDelta: 0.16,
    },
    bbox: "-107.52,24.70,-107.30,24.88",
    timezone: "America/Mazatlan",
    active: true,
  },
  mazatlan: {
    id: CITY_IDS.mazatlan,
    slug: "mazatlan",
    name: "Mazatlán",
    state: "Sinaloa",
    center: {
      latitude: 23.2494,
      longitude: -106.4111,
      latitudeDelta: 0.18,
      longitudeDelta: 0.18,
    },
    bbox: "-106.55,23.15,-106.25,23.35",
    timezone: "America/Mazatlan",
    // Fase 2: sync puede apuntar a Mazatlán. Default UI sigue siendo Culiacán.
    active: true,
  },
};

/** Default de la app en vivo (prod). No cambiar a mazatlan en esta fase. */
export const ACTIVE_CITY_SLUG: CitySlug = "culiacan";

export const CITY_PREFERENCE_KEY = "pulso_active_city_slug";

/** Preferencia de sesión/dispositivo (selector / ?city=). null = usar default. */
let cityPreference: CitySlug | null = null;

type CityChangeListener = (slug: CitySlug) => void;
const cityChangeListeners = new Set<CityChangeListener>();

export function isCitySlug(value: string | null | undefined): value is CitySlug {
  return value === "culiacan" || value === "mazatlan";
}

export function setCityPreference(slug: CitySlug | null): void {
  const prev = getActiveCitySlug();
  cityPreference = slug;
  const next = getActiveCitySlug();
  if (prev !== next) {
    cityChangeListeners.forEach((listener) => listener(next));
  }
}

/** Notifica cuando la ciudad activa cambia (mapa, copy, feeds). */
export function subscribeCityChange(listener: CityChangeListener): () => void {
  cityChangeListeners.add(listener);
  return () => {
    cityChangeListeners.delete(listener);
  };
}

export function getCityPreference(): CitySlug | null {
  return cityPreference;
}

export function getActiveCitySlug(): CitySlug {
  return cityPreference ?? ACTIVE_CITY_SLUG;
}

export function getActiveCity(): CityConfig {
  return CITIES[getActiveCitySlug()];
}

export function getActiveCityId(): string {
  return getActiveCity().id;
}

/** Etiqueta corta para copy/share: "Culiacán". */
export function getActiveCityName(): string {
  return getActiveCity().name;
}

/** "Culiacán, Sinaloa" */
export function getActiveCityLabel(): string {
  const c = getActiveCity();
  return `${c.name}, ${c.state}`;
}

/**
 * ¿Esta fila pertenece a la ciudad activa?
 * Usado en tests y como defensa cliente; las queries ya filtran en SQL.
 */
export function belongsToActiveCity(cityId: string | null | undefined): boolean {
  if (cityId == null) return false;
  return cityId === getActiveCityId();
}

/** Asunción de backfill: filas históricas → Culiacán. */
export function defaultBackfillCityId(): string {
  return CITY_IDS.culiacan;
}

/** Ciudades disponibles en el selector de producto. */
export function listSelectableCities(): CityConfig[] {
  return Object.values(CITIES).filter((c) => c.active);
}
