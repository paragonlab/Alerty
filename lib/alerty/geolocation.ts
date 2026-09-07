import { Platform } from "react-native";
import * as Location from "expo-location";
import type { UserCoords } from "./utils";

export type LocationRequestCode = "denied" | "unavailable" | "timeout";

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
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") throw new LocationRequestError("denied");
  const loc = await Location.getCurrentPositionAsync({});
  return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
}
