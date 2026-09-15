import { Linking, Platform } from "react-native";
import * as Location from "expo-location";
import type { UserCoords } from "./utils";

/**
 * - denied: se puede volver a preguntar (teléfono) o el navegador la bloqueó
 *   (web: el navegador ya no vuelve a preguntar; se permite en el candado).
 * - blocked: teléfono, el permiso se negó y el sistema ya no deja preguntar;
 *   solo se arregla en Ajustes.
 * - services_off: teléfono, la ubicación (GPS) está apagada.
 */
export type LocationRequestCode = "denied" | "blocked" | "services_off" | "unavailable" | "timeout";

export class LocationRequestError extends Error {
  code: LocationRequestCode;
  constructor(code: LocationRequestCode) {
    super(code);
    this.name = "LocationRequestError";
    this.code = code;
  }
}

export function getCurrentCoords(): Promise<UserCoords> {
  if (Platform.OS === "web") return getWebCoords();
  return getNativeCoords();
}

function getWebCoords(): Promise<UserCoords> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.reject(new LocationRequestError("unavailable"));
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      },
      (err) => {
        if (err.code === 1) reject(new LocationRequestError("denied"));
        else if (err.code === 3) reject(new LocationRequestError("timeout"));
        else reject(new LocationRequestError("unavailable"));
      },
      { enableHighAccuracy: false, maximumAge: 30_000, timeout: 12_000 },
    );
  });
}

async function getNativeCoords(): Promise<UserCoords> {
  const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    throw new LocationRequestError(canAskAgain ? "denied" : "blocked");
  }
  if (!(await Location.hasServicesEnabledAsync())) {
    throw new LocationRequestError("services_off");
  }
  try {
    const last = await Location.getLastKnownPositionAsync();
    if (last?.coords) {
      return { latitude: last.coords.latitude, longitude: last.coords.longitude };
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
  } catch {
    throw new LocationRequestError("unavailable");
  }
}

/**
 * Lo que hace el botón cuando pedir de nuevo no sirve: Ajustes de Pulso si el
 * permiso quedó bloqueado; en Android, el aviso del sistema para encender el
 * GPS. En web no hay nada que abrir: se permite en el candado de la barra.
 * Devuelve true si mandó a Ajustes (la app queda atrás); false si se puede
 * reintentar ya.
 */
export async function openLocationFix(code: LocationRequestCode): Promise<boolean> {
  if (Platform.OS === "web") return false;
  if (code === "services_off" && Platform.OS === "android") {
    try {
      await Location.enableNetworkProviderAsync();
      return false;
    } catch {
      // La persona dijo que no: se abre Ajustes abajo.
    }
  }
  if (code === "blocked" || code === "services_off") {
    await Linking.openSettings();
    return true;
  }
  return false;
}

/**
 * Para botones de "activar ubicación": reintenta y, si el problema es el permiso
 * bloqueado o el GPS apagado, lleva a arreglarlo. Así, al volver de Ajustes, el
 * mismo botón ya funciona en vez de mandar otra vez a Ajustes.
 */
export async function requestCoordsWithFix(): Promise<UserCoords> {
  try {
    return await getCurrentCoords();
  } catch (e) {
    if (!(e instanceof LocationRequestError) || (e.code !== "blocked" && e.code !== "services_off")) {
      throw e;
    }
    if (await openLocationFix(e.code)) throw e;
    return getCurrentCoords();
  }
}
