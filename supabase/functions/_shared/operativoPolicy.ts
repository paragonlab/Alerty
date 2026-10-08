/**
 * Política operativo (halconeo): sin coords en community_posts.
 * Debe alinearse con lib/alerty/operativoPolicy.ts y la migración
 * 20261008120000_operativo_delay_no_live_map.sql.
 */

import { CITY_IDS, cityName } from "./cities.ts";

export const OPERATIVO_CATEGORY = "operativo" as const;
/** Fallback si la fila no trae city_id (fase 1 / filas legacy). */
export const OPERATIVO_CITY_PLACE_LABEL = cityName(CITY_IDS.culiacan);

export function isOperativoCategory(category: string | null | undefined): boolean {
  return category === OPERATIVO_CATEGORY;
}

type GeoRow = {
  category_guess: string | null;
  lat: number | null;
  lng: number | null;
  place_label: string;
  geo_source: string;
  place_name_source: string | null;
  geocoded_from_text: string | null;
  city_id?: string | null;
};

/** Sync: nunca persistir ubicación precisa para operativo. */
export function stripOperativoGeo<T extends GeoRow>(row: T): T {
  if (!isOperativoCategory(row.category_guess)) return row;
  return {
    ...row,
    lat: null,
    lng: null,
    place_label: cityName(row.city_id) || OPERATIVO_CITY_PLACE_LABEL,
    geo_source: "none",
    place_name_source: null,
    geocoded_from_text: null,
  };
}
