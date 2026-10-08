/**
 * Helpers de filtro por ciudad para feeds del cliente.
 * Las queries de store usan getActiveCityId(); estas funciones
 * documentan y prueban el contrato (no mezclar ciudades).
 */
import { belongsToActiveCity, getActiveCityId } from "./city";

/** Columna FK usada en alerts / community_posts / sponsored_zones. */
export const CITY_FEED_COLUMN = "city_id" as const;

export type CityScopedRow = { city_id?: string | null };

/** Filtra filas ya traídas (defensa; la query SQL ya debe usar .eq). */
export function filterRowsByActiveCity<T extends CityScopedRow>(rows: T[]): T[] {
  return rows.filter((r) => belongsToActiveCity(r.city_id));
}

/** Valor que deben usar loadAlerts / loadCommunityPosts / loadSponsoredZones. */
export function cityIdForFeedQuery(): string {
  return getActiveCityId();
}
