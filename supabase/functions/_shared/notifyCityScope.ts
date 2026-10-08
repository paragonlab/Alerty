/**
 * Destinatarios de push críticos: solo usuarios cuya ciudad home
 * (users.city_id) coincide con la de la alerta. Sin esto, ciudad #2
 * spammearía a todos los tokens.
 */

export type PushTokenRow = {
  user_id: string;
  token: string;
  users?: { city_id?: string | null; push_enabled?: boolean } | Array<{
    city_id?: string | null;
    push_enabled?: boolean;
  }>;
};

export type WatchedZoneRow = {
  user_id: string;
  label: string;
  lat: number;
  lng: number;
  city_id?: string | null;
};

function userCityId(row: PushTokenRow): string | null {
  const users = row.users;
  const u = Array.isArray(users) ? users[0] : users;
  const id = u?.city_id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/** True si el token pertenece a un usuario de la misma ciudad que la alerta. */
export function tokenMatchesAlertCity(
  row: PushTokenRow,
  alertCityId: string | null | undefined,
): boolean {
  if (!alertCityId) return false;
  return userCityId(row) === alertCityId;
}

/** Filtra tokens de broadcast crítico por city_id. */
export function filterTokensByAlertCity(
  rows: PushTokenRow[],
  alertCityId: string | null | undefined,
): PushTokenRow[] {
  if (!alertCityId) return [];
  return rows.filter((r) => tokenMatchesAlertCity(r, alertCityId));
}

/** Zonas Círculo solo de la ciudad de la alerta. */
export function filterZonesByAlertCity(
  zones: WatchedZoneRow[],
  alertCityId: string | null | undefined,
): WatchedZoneRow[] {
  if (!alertCityId) return [];
  return zones.filter((z) => z.city_id === alertCityId);
}
