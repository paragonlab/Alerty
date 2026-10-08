/**
 * Persistencia de ciudad activa.
 * Fuentes: AsyncStorage, ?city= en web, selector de ciudad (mapa / Ajustes).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import {
  CITY_PREFERENCE_KEY,
  isCitySlug,
  setCityPreference,
  type CitySlug,
} from "./city";

function cityFromUrl(): CitySlug | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  try {
    const raw = new URLSearchParams(window.location.search).get("city");
    return isCitySlug(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** Carga preferencia (URL gana sobre storage) y la aplica en memoria. */
export async function hydrateCityPreference(): Promise<CitySlug | null> {
  const fromUrl = cityFromUrl();
  if (fromUrl) {
    setCityPreference(fromUrl);
    try {
      await AsyncStorage.setItem(CITY_PREFERENCE_KEY, fromUrl);
    } catch {
      /* ignore */
    }
    return fromUrl;
  }
  try {
    const stored = await AsyncStorage.getItem(CITY_PREFERENCE_KEY);
    if (isCitySlug(stored)) {
      setCityPreference(stored);
      return stored;
    }
  } catch {
    /* ignore */
  }
  setCityPreference(null);
  return null;
}

/** Cambia ciudad activa, persiste y opcionalmente actualiza ?city= en web. */
export async function persistCityPreference(slug: CitySlug): Promise<void> {
  setCityPreference(slug);
  try {
    await AsyncStorage.setItem(CITY_PREFERENCE_KEY, slug);
  } catch {
    /* ignore */
  }
  if (Platform.OS === "web" && typeof window !== "undefined") {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("city", slug);
      window.history.replaceState({}, "", url.toString());
    } catch {
      /* ignore */
    }
  }
}
