/**
 * Config de capa de tráfico (sin deps de React Native — testeable con tsx).
 */

/** TomTom Map Display / Traffic tiles (web Leaflet). */
export function getTomTomKey(): string {
  return (
    process.env.EXPO_PUBLIC_TOMTOM_KEY ||
    process.env.EXPO_PUBLIC_TOMTOM_API_KEY ||
    ""
  ).trim();
}

/** Feature flag maestro (default: on). Pon EXPO_PUBLIC_TRAFFIC_LAYER=0 para ocultar. */
export function isTrafficFeatureFlagOn(): boolean {
  return process.env.EXPO_PUBLIC_TRAFFIC_LAYER !== "0";
}

/**
 * Mock UI sin key real (screenshots / demos locales).
 * EXPO_PUBLIC_TRAFFIC_MOCK=1 → se muestra el toggle; tiles no se piden a TomTom.
 */
export function isTrafficMockEnabled(): boolean {
  return process.env.EXPO_PUBLIC_TRAFFIC_MOCK === "1";
}

/** URL de tile flow TomTom (relative0 = verde→rojo calmado). */
export function tomTomTrafficTileUrlTemplate(): string | null {
  const key = getTomTomKey();
  if (!key) return null;
  return `https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${encodeURIComponent(key)}&tileSize=256`;
}

export const TOMTOM_ATTRIBUTION = "© TomTom";
