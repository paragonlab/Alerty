/**
 * “Avísale a tu familia”: link que abre registro/instalación con zona prellenada.
 */

import { getActiveCitySlug } from "./city";
import { APP_SHARE_URL } from "./shareCore";

export type FamilyInviteParams = {
  /** Etiqueta legible (colonia o “cerca de…”). */
  zoneLabel: string;
  lat?: number | null;
  lng?: number | null;
  citySlug?: string;
};

export function familyInvitePath(params: FamilyInviteParams): string {
  const q = new URLSearchParams();
  q.set("invite", "familia");
  q.set("zone", params.zoneLabel.slice(0, 80));
  if (typeof params.lat === "number" && Number.isFinite(params.lat)) {
    // Redondeo a ~1 km: útil para prellenar, no doxxing.
    q.set("lat", params.lat.toFixed(3));
  }
  if (typeof params.lng === "number" && Number.isFinite(params.lng)) {
    q.set("lng", params.lng.toFixed(3));
  }
  q.set("city", params.citySlug ?? getActiveCitySlug());
  return `/onboarding?${q.toString()}`;
}

export function familyInviteUrl(params: FamilyInviteParams): string {
  return `${APP_SHARE_URL}${familyInvitePath(params)}`;
}

export function familyInviteMessage(params: FamilyInviteParams): string {
  const url = familyInviteUrl(params);
  return [
    `Hola — te comparto mi zona en Pulso: ${params.zoneLabel}.`,
    "Así te llegan avisos calmados de la colonia (no es denuncia ni 911).",
    url,
  ].join("\n");
}
