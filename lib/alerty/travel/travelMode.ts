/**
 * Modo viaje MVP: pulsos cerca del corredor México 15/15D y en la ciudad destino.
 * Sin routing API todavía — resolveCorridor() deja el gancho para después.
 */

import { CITIES, type CitySlug } from "../city";
import { CATEGORY_LABELS } from "../constants";
import { APP_SHARE_URL } from "../shareCore";
import {
  isOperativoCategory,
  isOperativoFeedReady,
} from "../operativoPolicy";
import type { AlertItem, CommunityPost, TimeFilter } from "../types";
import { calculateDistance, isAlertInWindow, isCommunityInWindow } from "../utils";
import {
  corridorBoundingRegion,
  getMexico15BundleCoordinates,
  getMexico15CorridorLines,
  type LatLng,
} from "./corridorMexico15";

export const CORRIDOR_BUFFER_KM = 2;
export type TravelDirection = "culiacan_to_mazatlan" | "mazatlan_to_culiacan";
export type TravelWindow = Extract<TimeFilter, "6h" | "24h">;

export type TravelPulseKind = "alert" | "community";

export type TravelPulse = {
  id: string;
  kind: TravelPulseKind;
  category: string;
  title: string;
  /** Etiqueta amplia (colonia/ciudad/tramo). Nunca coords de operativo. */
  placeLabel: string;
  createdAt: string;
  status?: "active" | "resolved";
  /** null si operativo (no pin preciso). */
  lat: number | null;
  lng: number | null;
  onCorridor: boolean;
  inDestination: boolean;
};

export type TravelSummary = {
  direction: TravelDirection | "custom";
  originSlug?: CitySlug;
  destinationSlug?: CitySlug;
  originName: string;
  destinationName: string;
  window: TravelWindow;
  windowLabel: string;
  total: number;
  cleared: number;
  byCategory: { category: string; label: string; count: number }[];
  corridorCount: number;
  destinationCount: number;
  pulses: TravelPulse[];
  /** Copy calmado — no promete “ruta segura”. */
  headline: string;
  blurb: string;
};

export type CorridorResolved = {
  source: "static" | "routing";
  lines: { id: string; name: string; coordinates: LatLng[] }[];
  /** Para buffer / cámara. */
  bundle: LatLng[];
  region: ReturnType<typeof corridorBoundingRegion>;
};

/**
 * Resuelve la polilínea del viaje.
 * MVP: siempre estático. Más adelante: si `routing` está definido, llamar API.
 */
export async function resolveCorridor(opts: {
  direction: TravelDirection;
  /** Reserva para Google Routes / TomTom / OSRM. */
  routing?: { provider: "google" | "tomtom" | "osrm"; apiKey?: string } | null;
}): Promise<CorridorResolved> {
  void opts.routing; // gancho futuro
  const lines = getMexico15CorridorLines();
  let bundle = getMexico15BundleCoordinates();
  if (opts.direction === "mazatlan_to_culiacan") {
    bundle = [...bundle].reverse();
  }
  return {
    source: "static",
    lines: opts.direction === "mazatlan_to_culiacan"
      ? lines.map((l) => ({ ...l, coordinates: [...l.coordinates].reverse() }))
      : lines,
    bundle,
    region: corridorBoundingRegion(bundle),
  };
}

function haversineKm(a: LatLng, b: LatLng): number {
  return calculateDistance(a.latitude, a.longitude, b.latitude, b.longitude);
}

/** Distancia mínima punto → segmento (km). */
export function distancePointToSegmentKm(
  p: LatLng,
  a: LatLng,
  b: LatLng,
): number {
  const latMid = ((a.latitude + b.latitude) / 2) * (Math.PI / 180);
  const cos = Math.cos(latMid) || 1e-6;
  const ax = a.longitude * cos;
  const ay = a.latitude;
  const bx = b.longitude * cos;
  const by = b.latitude;
  const px = p.longitude * cos;
  const py = p.latitude;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = 0;
  if (len2 > 1e-12) {
    t = ((px - ax) * dx + (py - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
  }
  const qx = ax + t * dx;
  const qy = ay + t * dy;
  // q en “grados estirados” → convertir de vuelta para haversine
  const q: LatLng = { latitude: qy, longitude: qx / cos };
  return haversineKm(p, q);
}

export function distanceToPolylineKm(p: LatLng, line: LatLng[]): number {
  if (line.length === 0) return Infinity;
  if (line.length === 1) return haversineKm(p, line[0]);
  let min = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    min = Math.min(min, distancePointToSegmentKm(p, line[i], line[i + 1]));
  }
  return min;
}

export function isNearCorridor(
  lat: number,
  lng: number,
  bundle: LatLng[],
  bufferKm = CORRIDOR_BUFFER_KM,
): boolean {
  return distanceToPolylineKm({ latitude: lat, longitude: lng }, bundle) <= bufferKm;
}

/** Ciudad destino: círculo generoso alrededor del centro (no bbox estricto). */
export function isInDestinationCity(
  lat: number,
  lng: number,
  destinationSlug: CitySlug,
  radiusKm = 18,
): boolean {
  const c = CITIES[destinationSlug].center;
  return calculateDistance(lat, lng, c.latitude, c.longitude) <= radiusKm;
}

export function directionEndpoints(direction: TravelDirection): {
  originSlug: CitySlug;
  destinationSlug: CitySlug;
} {
  if (direction === "mazatlan_to_culiacan") {
    return { originSlug: "mazatlan", destinationSlug: "culiacan" };
  }
  return { originSlug: "culiacan", destinationSlug: "mazatlan" };
}

function operativoPlaceLabel(destinationSlug: CitySlug, onCorridor: boolean): string {
  if (onCorridor) return "Tramo México 15 / 15D";
  return CITIES[destinationSlug].name;
}

function alertToPulse(
  alert: AlertItem,
  bundle: LatLng[],
  destinationSlug: CitySlug,
): TravelPulse | null {
  const operativo = isOperativoCategory(alert.category);
  if (operativo && !isOperativoFeedReady(alert.createdAt)) return null;

  const hasGeo = Number.isFinite(alert.lat) && Number.isFinite(alert.lng);
  // Operativo: coords solo para filtrar pertenencia al viaje; nunca se exponen.
  const nearCorridor =
    hasGeo && isNearCorridor(alert.lat, alert.lng, bundle);
  const nearDest =
    hasGeo && isInDestinationCity(alert.lat, alert.lng, destinationSlug);

  if (operativo) {
    const place = (alert.neighborhood || "").toLowerCase();
    const destName = CITIES[destinationSlug].name.toLowerCase();
    const placeMatch =
      place.includes(destName) ||
      place.includes("sinaloa") ||
      place.includes("carretera") ||
      place.includes("méxico 15") ||
      place.includes("mexico 15");
    if (!nearCorridor && !nearDest && !placeMatch) return null;
    return {
      id: alert.id,
      kind: "alert",
      category: alert.category,
      title: alert.title || CATEGORY_LABELS[alert.category] || "Aviso",
      placeLabel: operativoPlaceLabel(destinationSlug, nearCorridor || placeMatch),
      createdAt: alert.createdAt,
      status: alert.status,
      lat: null,
      lng: null,
      onCorridor: nearCorridor || placeMatch,
      inDestination: nearDest && !nearCorridor,
    };
  }

  if (!nearCorridor && !nearDest) return null;

  return {
    id: alert.id,
    kind: "alert",
    category: alert.category,
    title: alert.title || CATEGORY_LABELS[alert.category] || "Aviso",
    placeLabel: alert.neighborhood || CITIES[destinationSlug].name,
    createdAt: alert.createdAt,
    status: alert.status,
    lat: alert.lat,
    lng: alert.lng,
    onCorridor: nearCorridor,
    inDestination: nearDest,
  };
}

function communityToPulse(
  post: CommunityPost,
  bundle: LatLng[],
  destinationSlug: CitySlug,
): TravelPulse | null {
  const cat = post.categoryGuess || "otro";
  const operativo = isOperativoCategory(cat);
  if (operativo && !isOperativoFeedReady(post.createdAt)) return null;

  const hasGeo = typeof post.lat === "number" && typeof post.lng === "number";
  const onCorridor =
    !operativo && hasGeo && isNearCorridor(post.lat!, post.lng!, bundle);
  const inDestination =
    !operativo && hasGeo && isInDestinationCity(post.lat!, post.lng!, destinationSlug);

  if (operativo) {
    const place = (post.placeLabel || "").toLowerCase();
    const destName = CITIES[destinationSlug].name.toLowerCase();
    const likely =
      place.includes(destName) ||
      place.includes("méxico 15") ||
      place.includes("mexico 15") ||
      place.includes("carretera");
    if (!likely) return null;
    return {
      id: post.id,
      kind: "community",
      category: cat,
      title: post.text.slice(0, 120),
      placeLabel: operativoPlaceLabel(destinationSlug, true),
      createdAt: post.createdAt,
      status: post.status,
      lat: null,
      lng: null,
      onCorridor: true,
      inDestination: false,
    };
  }

  if (!onCorridor && !inDestination) return null;

  return {
    id: post.id,
    kind: "community",
    category: cat,
    title: post.text.slice(0, 120),
    placeLabel:
      post.source === "tomtom"
        ? `${post.placeLabel || CITIES[destinationSlug].name} · TomTom`
        : post.placeLabel || CITIES[destinationSlug].name,
    createdAt: post.createdAt,
    status: post.status === "resolved" ? "resolved" : "active",
    lat: post.lat,
    lng: post.lng,
    onCorridor,
    inDestination,
  };
}

export function collectTravelPulses(opts: {
  alerts: AlertItem[];
  communityPosts: CommunityPost[];
  direction: TravelDirection;
  window: TravelWindow;
  bundle: LatLng[];
}): TravelPulse[] {
  const { destinationSlug } = directionEndpoints(opts.direction);
  const out: TravelPulse[] = [];

  for (const alert of opts.alerts) {
    if (alert.parentAlertId) continue;
    if (alert.status !== "active" && alert.status !== "resolved") continue;
    if (!isAlertInWindow(alert, opts.window) && !isOperativoCategory(alert.category)) {
      continue;
    }
    if (isOperativoCategory(alert.category) && !isAlertInWindow(alert, opts.window)) {
      continue;
    }
    const pulse = alertToPulse(alert, opts.bundle, destinationSlug);
    if (pulse) out.push(pulse);
  }

  for (const post of opts.communityPosts) {
    if (!isCommunityInWindow(post, opts.window)) continue;
    const pulse = communityToPulse(post, opts.bundle, destinationSlug);
    if (pulse) out.push(pulse);
  }

  out.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return out;
}

export function buildTravelSummary(opts: {
  direction?: TravelDirection | "custom";
  originName?: string;
  destinationName?: string;
  window: TravelWindow;
  pulses: TravelPulse[];
}): TravelSummary {
  const direction = opts.direction ?? "custom";
  let originSlug: CitySlug | undefined;
  let destinationSlug: CitySlug | undefined;
  let originName = opts.originName;
  let destinationName = opts.destinationName;
  if (direction !== "custom") {
    const ends = directionEndpoints(direction);
    originSlug = ends.originSlug;
    destinationSlug = ends.destinationSlug;
    originName = originName || CITIES[originSlug].name;
    destinationName = destinationName || CITIES[destinationSlug].name;
  }
  originName = originName || "Origen";
  destinationName = destinationName || "Destino";
  const windowLabel = opts.window === "6h" ? "últimas 6 horas" : "últimas 24 horas";

  const counts = new Map<string, number>();
  let cleared = 0;
  let corridorCount = 0;
  let destinationCount = 0;
  for (const p of opts.pulses) {
    counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    if (p.status === "resolved") cleared += 1;
    if (p.onCorridor) corridorCount += 1;
    if (p.inDestination) destinationCount += 1;
  }

  const byCategory = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => ({
      category,
      label: CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] ?? category,
      count,
    }));

  const total = opts.pulses.length;
  let headline: string;
  let blurb: string;
  if (total === 0) {
    headline = `Sin avisos recientes hacia ${destinationName}`;
    blurb =
      "Lo que vecinos y medios reportaron cerca del camino aparece aquí. No prometemos una ruta segura: solo lo compartido.";
  } else {
    const parts: string[] = [];
    if (corridorCount > 0) {
      parts.push(
        `${corridorCount} ${corridorCount === 1 ? "aviso" : "avisos"} cerca del camino`,
      );
    }
    if (destinationCount > 0) {
      parts.push(`${destinationCount} en ${destinationName}`);
    }
    headline =
      parts.length > 0
        ? parts.join(" · ")
        : `${total} ${total === 1 ? "aviso" : "avisos"} en ${windowLabel}`;
    blurb =
      cleared > 0
        ? `${cleared === 1 ? "1 ya se despejó" : `${cleared} ya se despejaron`}. Lo que la comunidad reportó cerca del camino — sin ubicación en vivo de operativos.`
        : "Lo que la comunidad reportó cerca del camino. Sin prometer ruta segura; operativos van con retraso y sin coords en vivo.";
  }

  return {
    direction,
    originSlug,
    destinationSlug,
    originName,
    destinationName,
    window: opts.window,
    windowLabel,
    total,
    cleared,
    byCategory,
    corridorCount,
    destinationCount,
    pulses: opts.pulses,
    headline,
    blurb,
  };
}

/** Filtra pulsos locales por polilínea de ruta (~2 km). */
export function collectPulsesNearPolyline(opts: {
  alerts: AlertItem[];
  communityPosts: CommunityPost[];
  window: TravelWindow;
  polyline: LatLng[];
  destinationName: string;
}): TravelPulse[] {
  const bundle = opts.polyline;
  if (bundle.length < 2) return [];
  const out: TravelPulse[] = [];

  for (const alert of opts.alerts) {
    if (alert.parentAlertId) continue;
    if (alert.status !== "active" && alert.status !== "resolved") continue;
    if (!isAlertInWindow(alert, opts.window) && !isOperativoCategory(alert.category)) {
      continue;
    }
    if (isOperativoCategory(alert.category) && !isAlertInWindow(alert, opts.window)) {
      continue;
    }
    const hasGeo = Number.isFinite(alert.lat) && Number.isFinite(alert.lng);
    if (!hasGeo) continue;
    const onCorridor = isNearCorridor(alert.lat, alert.lng, bundle);
    if (!onCorridor) continue;
    const operativo = isOperativoCategory(alert.category);
    out.push({
      id: alert.id,
      kind: "alert",
      category: alert.category,
      title: alert.title || CATEGORY_LABELS[alert.category] || "Aviso",
      placeLabel: operativo
        ? "En el camino"
        : alert.neighborhood || opts.destinationName,
      createdAt: alert.createdAt,
      status: alert.status,
      lat: operativo ? null : alert.lat,
      lng: operativo ? null : alert.lng,
      onCorridor: true,
      inDestination: false,
    });
  }

  for (const post of opts.communityPosts) {
    if (!isCommunityInWindow(post, opts.window)) continue;
    const hasGeo = typeof post.lat === "number" && typeof post.lng === "number";
    if (!hasGeo) continue;
    const cat = post.categoryGuess || "otro";
    const operativo = isOperativoCategory(cat);
    if (operativo && !isOperativoFeedReady(post.createdAt)) continue;
    if (!operativo && !isNearCorridor(post.lat!, post.lng!, bundle)) continue;
    if (operativo) {
      const place = (post.placeLabel || "").toLowerCase();
      if (!place.includes("carretera") && !place.includes("camino")) continue;
    }
    out.push({
      id: post.id,
      kind: "community",
      category: cat,
      title: post.text.slice(0, 120),
      placeLabel: operativo
        ? "En el camino"
        : post.placeLabel || opts.destinationName,
      createdAt: post.createdAt,
      status: post.status === "resolved" ? "resolved" : "active",
      lat: operativo ? null : post.lat,
      lng: operativo ? null : post.lng,
      onCorridor: true,
      inDestination: false,
    });
  }

  out.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return out;
}

export function travelShareMessage(summary: TravelSummary): string {
  const lines = [
    `Pulso · Antes de salir`,
    `${summary.originName} → ${summary.destinationName}`,
    summary.headline,
  ];
  for (const row of summary.byCategory.slice(0, 5)) {
    lines.push(`· ${row.label}: ${row.count}`);
  }
  if (summary.cleared > 0) {
    lines.push(
      summary.cleared === 1
        ? "1 aviso ya se despejó"
        : `${summary.cleared} avisos ya se despejaron`,
    );
  }
  lines.push(summary.blurb.split("—")[0].trim());
  lines.push(`Ventana: ${summary.windowLabel}`);
  lines.push(APP_SHARE_URL);
  return lines.join("\n");
}

export function isTravelModeEnabled(): boolean {
  return process.env.EXPO_PUBLIC_TRAVEL_MODE !== "0";
}
