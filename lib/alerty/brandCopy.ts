/**
 * Taglines y blurbs de marca / share / meta.
 * Con ciudad activa → nombre vía getActiveCity*.
 * Sin ciudad (meta global del sitio) → tono neutro o “Culiacán y Mazatlán”.
 */

import { getActiveCityName } from "./city";
import { APP_SHARE_URL } from "./shareCore";

/** Ciudades de producto cuando el copy es global (landing, app store, llms). */
export const SITE_CITIES_LABEL = "Culiacán y Mazatlán";

/** ¿Cómo está tu colonia…? — ciudad concreta o “hoy” si no hay contexto. */
export function coloniaTagline(cityName?: string | null): string {
  const city = (cityName ?? "").trim();
  if (city) return `¿Cómo está tu colonia en ${city}?`;
  return "¿Cómo está tu colonia hoy?";
}

/** Título corto tipo “Pulso Ciudadano · Cómo está tu colonia en Mazatlán”. */
export function siteDocumentTitle(cityName?: string | null): string {
  const city = (cityName ?? "").trim();
  if (city) return `Pulso Ciudadano · Cómo está tu colonia en ${city}`;
  return "Pulso Ciudadano · Cómo está tu colonia hoy";
}

/** Descripción corta para meta/OG/share. */
export function neighborsBlurb(cityName?: string | null): string {
  const city = (cityName ?? "").trim();
  const where = city || SITE_CITIES_LABEL;
  return `Vecinos de ${where} avisándose entre sí. Checa cómo está tu zona antes de salir. No es un canal de denuncia y no llama al 911.`;
}

/** Tagline con la ciudad activa de la sesión. */
export function activeColoniaTagline(): string {
  return coloniaTagline(getActiveCityName());
}

export function activeNeighborsBlurb(): string {
  return neighborsBlurb(getActiveCityName());
}

export function activeSiteDocumentTitle(): string {
  return siteDocumentTitle(getActiveCityName());
}

/** Mensaje al compartir la app (no un pulso concreto). */
export function appShareMessage(cityName?: string | null): string {
  const city = (cityName ?? getActiveCityName()).trim() || null;
  return [
    `Pulso · ${coloniaTagline(city)}`,
    neighborsBlurb(city),
    `Abre el mapa: ${APP_SHARE_URL}`,
  ].join("\n");
}
