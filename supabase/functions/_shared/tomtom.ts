/**
 * Helpers TomTom para edge functions (Incidents, Flow, Routing, Search).
 * Key solo en secret TOMTOM_API_KEY — nunca en el cliente.
 */

import { CITY_IDS } from "./cities.ts";

export const TOMTOM_ATTRIBUTION = "Datos de tráfico © TomTom";

/** Bboxes EPSG:4326: minLon,minLat,maxLon,maxLat (≤ 10_000 km²). */
export const TOMTOM_BBOXES = {
  culiacan: {
    cityId: CITY_IDS.culiacan,
    label: "Culiacán",
    bbox: "-107.52,24.70,-107.30,24.88",
  },
  mazatlan: {
    cityId: CITY_IDS.mazatlan,
    label: "Mazatlán",
    bbox: "-106.55,23.15,-106.25,23.35",
  },
  /** Corredor México 15 / 15D (amplio pero bajo el límite de área). */
  corridor: {
    cityId: CITY_IDS.culiacan,
    label: "México 15 / 15D",
    bbox: "-107.50,23.20,-106.30,24.85",
  },
} as const;

export type TomtomBboxKey = keyof typeof TOMTOM_BBOXES;

/** Puntos clave del corredor para Flow Segment (retraso por tramo). */
export const CORRIDOR_FLOW_POINTS = [
  { id: "culiacan_sur", label: "salida de Culiacán", lat: 24.72, lng: -107.43 },
  { id: "costa_rica", label: "cerca de Costa Rica", lat: 24.55, lng: -107.45 },
  { id: "elota", label: "cerca de Elota", lat: 23.95, lng: -107.02 },
  { id: "dimas", label: "cerca de Dimas", lat: 23.72, lng: -106.78 },
  { id: "villa_union", label: "cerca de Villa Unión", lat: 23.28, lng: -106.35 },
] as const;

/** iconCategory TomTom → categoría Pulso + copy calmado. */
export function mapTomtomCategory(iconCategory: number | null | undefined): {
  category: string;
  calmVerb: string;
} {
  switch (iconCategory) {
    case 1: // Accident
    case 14: // BrokenDownVehicle
      return { category: "accidente", calmVerb: "Precaución" };
    case 7: // LaneClosed
    case 8: // RoadClosed
      return { category: "bloqueo", calmVerb: "Hay un tramo cerrado" };
    case 9: // RoadWorks
      return { category: "bloqueo", calmVerb: "Hay obras" };
    case 6: // Jam
      return { category: "bloqueo", calmVerb: "Va lento" };
    case 11: // Flooding
      return { category: "inundacion", calmVerb: "Hay encharcamiento" };
    case 3: // DangerousConditions
      return { category: "alerta", calmVerb: "Condiciones difíciles" };
    default:
      return { category: "alerta", calmVerb: "Aviso de circulación" };
  }
}

export function calmIncidentText(opts: {
  iconCategory: number | null | undefined;
  description?: string | null;
  from?: string | null;
  to?: string | null;
  placeLabel: string;
}): string {
  const { calmVerb } = mapTomtomCategory(opts.iconCategory);
  const desc = (opts.description || "").trim();
  const fromTo =
    opts.from && opts.to
      ? ` · ${opts.from} → ${opts.to}`
      : opts.from
        ? ` · ${opts.from}`
        : "";
  if (desc && desc.length > 8) {
    return `${calmVerb} en ${opts.placeLabel}${fromTo}. ${desc}`.slice(0, 280);
  }
  return `${calmVerb} en ${opts.placeLabel}${fromTo}.`.slice(0, 280);
}

export function tomtomKey(): string {
  return (Deno.env.get("TOMTOM_API_KEY") || "").trim();
}

export async function tomtomGetJson(
  pathAndQuery: string,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const key = tomtomKey();
  if (!key) return { ok: false, status: 0, data: { error: "missing_TOMTOM_API_KEY" } };
  const url = pathAndQuery.includes("?")
    ? `https://api.tomtom.com${pathAndQuery}&key=${encodeURIComponent(key)}`
    : `https://api.tomtom.com${pathAndQuery}?key=${encodeURIComponent(key)}`;
  const r = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  let data: unknown = null;
  try {
    data = await r.json();
  } catch {
    data = null;
  }
  return { ok: r.ok, status: r.status, data };
}

/**
 * Presupuesto free: 2.5k non-tile/día.
 * Con 3 bbox incidents cada 20 min ≈ 216/día.
 * Flow 5 puntos cada 30 min ≈ 240/día.
 * Routing + POI cacheados: margen amplio bajo el tope.
 */
export const TOMTOM_BUDGET = {
  freeNonTilePerDay: 2500,
  incidentBboxes: 3,
  incidentIntervalMinutes: 20,
  estimatedIncidentRequestsPerDay: Math.ceil((24 * 60) / 20) * 3, // 216
  flowPoints: CORRIDOR_FLOW_POINTS.length,
  flowIntervalMinutes: 30,
  estimatedFlowRequestsPerDay: Math.ceil((24 * 60) / 30) * CORRIDOR_FLOW_POINTS.length, // 240
};

/** Rate limit tomtom-travel: ventana fija en tomtom_cache. */
export const TOMTOM_TRAVEL_RATE = {
  windowSeconds: 5 * 60,
  maxPerIp: 12,
  maxPerUser: 20,
} as const;

export function clientIpFromHeaders(headers: Headers): string {
  const xf = headers.get("x-forwarded-for") || headers.get("x-real-ip") || "";
  const first = xf.split(",")[0]?.trim();
  if (first) return first.slice(0, 64);
  const cf = headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf.slice(0, 64);
  return "unknown";
}

export function rateLimitBucket(nowMs = Date.now(), windowSeconds = TOMTOM_TRAVEL_RATE.windowSeconds): number {
  return Math.floor(nowMs / (windowSeconds * 1000));
}

export function rateLimitCacheKey(kind: "ip" | "user", id: string, bucket: number): string {
  const safe = id.replace(/[^a-zA-Z0-9._:@-]/g, "_").slice(0, 80);
  return `ratelimit:${kind}:${safe}:${bucket}`;
}

// ── Parsers (fixtures + respuestas reales) ──────────────────────────────────

export type TomtomIncidentFeature = {
  type?: string;
  geometry?: {
    type?: string;
    coordinates?: number[] | number[][];
  };
  properties?: {
    id?: string;
    iconCategory?: number;
    magnitudeOfDelay?: number;
    events?: Array<{ description?: string; code?: number }>;
    from?: string | null;
    to?: string | null;
    startTime?: string;
    endTime?: string | null;
    timeValidity?: string;
  };
};

export function pointFromIncidentGeometry(
  geom: TomtomIncidentFeature["geometry"],
): { lat: number; lng: number } | null {
  if (!geom?.coordinates) return null;
  if (geom.type === "Point" && Array.isArray(geom.coordinates)) {
    const [lng, lat] = geom.coordinates as number[];
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  if (geom.type === "LineString" && Array.isArray(geom.coordinates)) {
    const coords = geom.coordinates as number[][];
    const mid = coords[Math.floor(coords.length / 2)];
    if (mid && Number.isFinite(mid[1]) && Number.isFinite(mid[0])) {
      return { lat: mid[1], lng: mid[0] };
    }
  }
  return null;
}

/** Extrae features de incidentDetails v5 (o fixture). */
export function parseIncidentDetails(data: unknown): TomtomIncidentFeature[] {
  if (!data || typeof data !== "object") return [];
  const incidents = (data as { incidents?: unknown }).incidents;
  return Array.isArray(incidents) ? (incidents as TomtomIncidentFeature[]) : [];
}

/** Minutos extra vs free-flow desde flowSegmentData. */
export function extraMinutesFromFlow(data: unknown): number {
  if (!data || typeof data !== "object") return 0;
  const seg = (data as {
    flowSegmentData?: { currentTravelTime?: number; freeFlowTravelTime?: number };
  }).flowSegmentData;
  if (!seg) return 0;
  const cur = Number(seg.currentTravelTime) || 0;
  const free = Number(seg.freeFlowTravelTime) || 0;
  return Math.max(0, Math.round((cur - free) / 60));
}

export type ParsedRoute = {
  summary: string;
  travelTimeMinutes: number;
  trafficDelayMinutes: number;
  lengthKm: number;
  alternates: Array<{
    summary: string;
    travelTimeMinutes: number;
    trafficDelayMinutes: number;
  }>;
};

export function parseCalculateRoute(data: unknown): ParsedRoute | null {
  if (!data || typeof data !== "object") return null;
  const routes = (data as {
    routes?: Array<{
      summary?: {
        lengthInMeters?: number;
        travelTimeInSeconds?: number;
        trafficDelayInSeconds?: number;
      };
    }>;
  }).routes;
  if (!routes?.length) return null;
  const primary = routes[0].summary || {};
  return {
    summary: "Ruta con tráfico",
    travelTimeMinutes: Math.round((primary.travelTimeInSeconds || 0) / 60),
    trafficDelayMinutes: Math.round((primary.trafficDelayInSeconds || 0) / 60),
    lengthKm: Math.round(((primary.lengthInMeters || 0) / 1000) * 10) / 10,
    alternates: routes.slice(1).map((r) => ({
      summary: "Alterna",
      travelTimeMinutes: Math.round((r.summary?.travelTimeInSeconds || 0) / 60),
      trafficDelayMinutes: Math.round((r.summary?.trafficDelayInSeconds || 0) / 60),
    })),
  };
}

export type ParsedPoi = { name: string; lat: number; lng: number; distKm: number };

export function parseNearbySearch(data: unknown): ParsedPoi[] {
  if (!data || typeof data !== "object") return [];
  const results = (data as {
    results?: Array<{
      poi?: { name?: string };
      position?: { lat?: number; lon?: number };
      dist?: number;
    }>;
  }).results;
  if (!Array.isArray(results)) return [];
  return results.slice(0, 5).map((r) => ({
    name: r.poi?.name || "POI",
    lat: r.position?.lat ?? 0,
    lng: r.position?.lon ?? 0,
    distKm: Math.round(((r.dist || 0) / 1000) * 10) / 10,
  }));
}
