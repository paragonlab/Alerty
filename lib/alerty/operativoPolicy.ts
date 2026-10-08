/**
 * Política legal/seguridad para la categoría "operativo" (halconeo en Sinaloa).
 *
 * - No se reporta desde la app (fuera de ALERT_CATEGORIES).
 * - Nunca va al mapa en vivo ni dispara push.
 * - En listas/feeds solo tras OPERATIVO_FEED_DELAY_MS, sin coords ni enlace al mapa;
 *   el lugar se generaliza a la ciudad.
 *
 * El intervalo de 2 h debe coincidir con la RLS en
 * supabase/migrations/20261008120000_operativo_delay_no_live_map.sql
 */

export const OPERATIVO_CATEGORY = "operativo" as const;

/** Retraso mínimo desde publicación antes de mostrar un pulso operativo en listas. */
export const OPERATIVO_FEED_DELAY_MS = 2 * 60 * 60 * 1000;

/** Lugar genérico: sin colonia ni coords precisas. */
export const OPERATIVO_CITY_PLACE_LABEL = "Culiacán";

export function isOperativoCategory(category: string | null | undefined): boolean {
  return category === OPERATIVO_CATEGORY;
}

/** True cuando el post operativo ya puede aparecer en Pulsos / feeds / cards. */
export function isOperativoFeedReady(createdAt: string, nowMs = Date.now()): boolean {
  const at = new Date(createdAt).getTime();
  if (!Number.isFinite(at)) return false;
  return nowMs - at >= OPERATIVO_FEED_DELAY_MS;
}

type LocFields = {
  lat: number | null;
  lng: number | null;
  placeLabel: string;
  geoSource?: string | null;
  placeNameSource?: string | null;
  geocodedFromText?: string | null;
  categoryGuess?: string | null;
};

/** Quita ubicación usable de un post operativo (defensa en cliente). */
export function redactOperativoLocation<T extends LocFields>(post: T): T {
  if (!isOperativoCategory(post.categoryGuess)) return post;
  return {
    ...post,
    lat: null,
    lng: null,
    placeLabel: OPERATIVO_CITY_PLACE_LABEL,
    geoSource: "none",
    placeNameSource: null,
    geocodedFromText: null,
  };
}

/**
 * ¿Puede este post de comunidad entrar al mapa (pines, clusters, calor)?
 * Operativo: nunca, aunque aún tenga coords en filas viejas o cache.
 */
export function isCommunityMapEligibleCategory(categoryGuess: string | null | undefined): boolean {
  return !isOperativoCategory(categoryGuess);
}
