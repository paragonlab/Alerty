/**
 * Preferencia de capa de tráfico (opt-in, apagada por defecto).
 * Persistida en AsyncStorage; no es preferencia de cuenta.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import {
  getTomTomKey,
  isTrafficFeatureFlagOn,
  isTrafficMockEnabled,
  tomTomTrafficTileUrlTemplate,
  TOMTOM_ATTRIBUTION,
} from "./trafficConfig";

export {
  getTomTomKey,
  isTrafficFeatureFlagOn,
  isTrafficMockEnabled,
  tomTomTrafficTileUrlTemplate,
  TOMTOM_ATTRIBUTION,
};

export const TRAFFIC_PREF_KEY = "pulso_show_traffic";
export const TRAFFIC_USAGE_KEY = "pulso_traffic_toggle_count";

/** ¿Mostrar el toggle en esta plataforma? */
export function isTrafficToggleAvailable(): boolean {
  if (!isTrafficFeatureFlagOn()) return false;
  if (Platform.OS !== "web") return true; // Google showsTraffic nativo
  if (getTomTomKey()) return true;
  return isTrafficMockEnabled();
}

let showTrafficMem = false;
const listeners = new Set<(on: boolean) => void>();

export function getShowTraffic(): boolean {
  return showTrafficMem;
}

export function subscribeTrafficPreference(listener: (on: boolean) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(on: boolean) {
  listeners.forEach((l) => l(on));
}

export async function hydrateTrafficPreference(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(TRAFFIC_PREF_KEY);
    showTrafficMem = raw === "1";
  } catch {
    showTrafficMem = false;
  }
  emit(showTrafficMem);
  return showTrafficMem;
}

export async function persistTrafficPreference(on: boolean): Promise<void> {
  showTrafficMem = on;
  emit(on);
  try {
    await AsyncStorage.setItem(TRAFFIC_PREF_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
  if (on) {
    void bumpTrafficUsageCount();
  }
}

/** Contador local barato (sin red). Útil para ver adopción del toggle. */
export async function bumpTrafficUsageCount(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(TRAFFIC_USAGE_KEY);
    const n = (Number(raw) || 0) + 1;
    await AsyncStorage.setItem(TRAFFIC_USAGE_KEY, String(n));
    return n;
  } catch {
    return 0;
  }
}

export async function getTrafficUsageCount(): Promise<number> {
  try {
    return Number(await AsyncStorage.getItem(TRAFFIC_USAGE_KEY)) || 0;
  } catch {
    return 0;
  }
}
