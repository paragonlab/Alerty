/**
 * Helpers TomTom para edge functions (Incidents, Flow, Routing, Search).
 * Key solo en secret TOMTOM_API_KEY — nunca en el cliente.
 */

import { CITY_IDS, CITY_NAMES } from "./cities.ts";

export const TOMTOM_ATTRIBUTION = "Datos de tráfico © TomTom";

/** Límite de área de Incident Details (TomTom). */
export const TOMTOM_MAX_BBOX_KM2 = 10_000;

export type TomtomBboxDef = {
  key: string;
  label: string;
  /** minLon,minLat,maxLon,maxLat */
  bbox: string;
  /** Solo cajas de ciudad; corredor asigna city_id por coords. */
  cityId?: string;
};

/**
 * Bboxes ≤ 10_000 km². El corredor va en tramos que no solapan las cajas
 * de Culiacán / Mazatlán (dedupe por id TomTom).
 */
export const TOMTOM_BBOXES: readonly TomtomBboxDef[] = [
  {
    key: "culiacan",
    label: "Culiacán",
    bbox: "-107.52,24.70,-107.30,24.88",
    cityId: CITY_IDS.culiacan,
  },
  {
    key: "mazatlan",
    label: "Mazatlán",
    bbox: "-106.55,23.15,-106.25,23.35",
    cityId: CITY_IDS.mazatlan,
  },
  {
    key: "corridor_n",
    label: "México 15 / 15D (norte)",
    // Sur de la caja Culiacán (maxLat < 24.70)
    bbox: "-107.55,24.35,-107.15,24.69",
  },
  {
    key: "corridor_c",
    label: "México 15 / 15D (centro)",
    bbox: "-107.35,23.70,-106.55,24.35",
  },
  {
    key: "corridor_s",
    label: "México 15 / 15D (sur)",
    // Norte de la caja Mazatlán (minLat > 23.35)
    bbox: "-106.95,23.36,-106.20,23.70",
  },
] as const;

export type TomtomBboxKey = (typeof TOMTOM_BBOXES)[number]["key"];

/** Centros de ciudades activas (city_id por cercanía). */
export const ACTIVE_CITY_CENTERS = [
  { cityId: CITY_IDS.culiacan, label: "Culiacán", lat: 24.8091, lng: -107.394 },
  { cityId: CITY_IDS.mazatlan, label: "Mazatlán", lat: 23.2494, lng: -106.4111 },
] as const;

/** Puntos clave del corredor para Flow Segment (retraso por tramo). */
export const CORRIDOR_FLOW_POINTS = [
  { id: "culiacan_sur", label: "salida de Culiacán", lat: 24.72, lng: -107.43 },
  { id: "costa_rica", label: "cerca de Costa Rica", lat: 24.55, lng: -107.45 },
  { id: "elota", label: "cerca de Elota", lat: 23.95, lng: -107.02 },
  { id: "dimas", label: "cerca de Dimas", lat: 23.72, lng: -106.78 },
  { id: "villa_union", label: "cerca de Villa Unión", lat: 23.28, lng: -106.35 },
] as const;

/**
 * Categorías Search API (IDs numéricos TomTom).
 * 7311 = petrol; 7309 = EV charging; 7321 = hospital; 7326 = pharmacy; 7375 = toll.
 */
export const TOMTOM_POI_CATEGORIES = {
  gas_station: "7311",
  ev_charging: "7309",
  hospital: "7321",
  pharmacy: "7326",
  toll: "7375",
} as const;

/** NearbySearch: radio máximo documentado = 50_000 m. */
export const TOMTOM_POI_MAX_RADIUS_M = 50_000;

/** Muestras a lo largo del corredor (≤50 km c/u cubre México 15/15D). */
export const TOMTOM_POI_SAMPLE_POINTS = [
  CORRIDOR_FLOW_POINTS[0], // Culiacán sur
  CORRIDOR_FLOW_POINTS[2], // Elota
  CORRIDOR_FLOW_POINTS[4], // Villa Unión
] as const;

export const TOMTOM_POI_CACHE_KEY = "poi:corridor:v4";
export const TOMTOM_POI_CACHE_TTL_OK_SEC = 6 * 3600;
/** Fallidos / vacíos / parciales: TTL corto para reintentar sin pegarle al free tier. */
export const TOMTOM_POI_CACHE_TTL_EMPTY_SEC = 10 * 60;
/** Espacio entre requests NearbySearch (QPS TomTom). */
export const TOMTOM_POI_REQUEST_GAP_MS = 250;
export const TOMTOM_POI_RETRY_BACKOFF_MS = 1000;

/** Aliado dentro de este radio de una muestra/flujo del corredor → entra al listado. */
export const ALIADO_CORRIDOR_MAX_KM = 2;
/** Mismo lugar TomTom↔Aliado: nombre similar + distancia. */
export const ALIADO_TOMTOM_DEDUPE_M = 150;

export type TomtomPoiKind = keyof typeof TOMTOM_POI_CATEGORIES;

/** Pistas de categoría para filtrar falsos positivos (p. ej. taller como hospital). */
export const TOMTOM_POI_CATEGORY_HINTS: Record<
  TomtomPoiKind,
  { ids: number[]; nameRe: RegExp; rejectRe?: RegExp }
> = {
  gas_station: {
    ids: [7311],
    nameRe: /petrol|gasolin|combustible|pemex|shell|bp\b|mobil|fuel\s*station/i,
    rejectRe: /electric|ev\s*charg|carga\s*el[eé]ctrica|cargador/i,
  },
  ev_charging: {
    ids: [7309],
    nameRe: /electric|ev\s*charg|carga\s*el[eé]ctrica|cargador|electrolinera/i,
    rejectRe: /petrol|gasolin|pemex(?!\s*ev)/i,
  },
  hospital: {
    ids: [7321],
    nameRe: /hospital|cl[ií]nic|polyclinic|m[eé]dic/i,
    rejectRe: /taller|mec[aá]nic|vulcaniz|refaccion|auto\s*parts|car\s*repair/i,
  },
  pharmacy: {
    ids: [7326],
    nameRe: /farmac|pharmacy|dispensar|botica/i,
  },
  toll: {
    ids: [7375],
    nameRe: /caseta|toll|peatge|plaza\s*de\s*cobro|peaje/i,
  },
};

export function poiListsAreEmpty(
  pois: Record<string, Array<unknown>>,
): boolean {
  return Object.values(pois).every((list) => !Array.isArray(list) || list.length === 0);
}

export function categoryIdMatches(expected: number, id: number): boolean {
  if (id === expected) return true;
  // Subcategorías TomTom a menudo son expected * 1000 + n
  return Math.floor(id / 1000) === expected || String(id).startsWith(String(expected));
}

export function poiMatchesExpectedCategory(
  kind: string,
  poi: {
    name?: string;
    categoryIds?: number[];
    categories?: string[];
  },
): boolean {
  const hint = TOMTOM_POI_CATEGORY_HINTS[kind as TomtomPoiKind];
  if (!hint) return true;
  const blob = [...(poi.categories ?? []), poi.name ?? ""].join(" ");
  if (hint.rejectRe?.test(blob)) return false;
  const ids = poi.categoryIds ?? [];
  if (ids.length > 0) {
    return ids.some((id) => hint.ids.some((exp) => categoryIdMatches(exp, id)));
  }
  return hint.nameRe.test(blob);
}

export function dedupePoisByNamePos<T extends { name: string; lat: number; lng: number }>(
  items: T[],
  limit = 5,
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const p of items) {
    const key = `${p.name.toLowerCase()}|${p.lat.toFixed(3)}|${p.lng.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}

/** Plan de fetch: por categoría, cada muestra del corredor. */
export function buildPoiFetchPlan(
  kinds: TomtomPoiKind[] = Object.keys(TOMTOM_POI_CATEGORIES) as TomtomPoiKind[],
  pointCount = TOMTOM_POI_SAMPLE_POINTS.length,
): Array<{ kind: TomtomPoiKind; categoryId: string; pointIndex: number }> {
  const plan: Array<{ kind: TomtomPoiKind; categoryId: string; pointIndex: number }> = [];
  for (const kind of kinds) {
    for (let i = 0; i < pointCount; i++) {
      plan.push({ kind, categoryId: TOMTOM_POI_CATEGORIES[kind], pointIndex: i });
    }
  }
  return plan;
}

/**
 * Elige hasta `limit` POIs repartidos a lo largo de las muestras (round-robin),
 * no solo los del primer punto (Culiacán).
 */
export function pickPoisRoundRobinBySample<T extends { name: string; lat: number; lng: number }>(
  bySample: T[][],
  limit = 5,
): T[] {
  const queues = bySample.map((list) => [...list]);
  const seen = new Set<string>();
  const out: T[] = [];
  let progressed = true;
  while (out.length < limit && progressed) {
    progressed = false;
    for (const q of queues) {
      while (q.length > 0) {
        const p = q.shift()!;
        const key = `${p.name.toLowerCase()}|${p.lat.toFixed(3)}|${p.lng.toFixed(3)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(p);
        progressed = true;
        break;
      }
      if (out.length >= limit) break;
    }
  }
  return out;
}

export function poiCacheTtlSeconds(opts: {
  empty: boolean;
  anyFailed: boolean;
}): number {
  if (opts.empty || opts.anyFailed) return TOMTOM_POI_CACHE_TTL_EMPTY_SEC;
  return TOMTOM_POI_CACHE_TTL_OK_SEC;
}

export type AliadoForPoi = {
  id: string;
  name: string;
  description?: string | null;
  lat: number;
  lng: number;
  logoUrl?: string | null;
  pinGiro?: string | null;
  type?: string | null;
};

export type TravelPoi = {
  name: string;
  lat: number;
  lng: number;
  distKm: number;
  source: "tomtom" | "aliado";
  aliado?: boolean;
  badge?: string;
  logoUrl?: string | null;
  promo?: string | null;
  id?: string;
};

export function normalizePoiName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function namesRoughlyMatch(a: string, b: string): boolean {
  const na = normalizePoiName(a);
  const nb = normalizePoiName(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

/** Distancia mínima a cualquier punto de muestra/flujo del corredor. */
export function minKmToCorridor(
  lat: number,
  lng: number,
  points: ReadonlyArray<{ lat: number; lng: number }> = [
    ...TOMTOM_POI_SAMPLE_POINTS,
    ...CORRIDOR_FLOW_POINTS,
  ],
): number {
  let best = Infinity;
  for (const p of points) {
    const km = haversineKm(lat, lng, p.lat, p.lng);
    if (km < best) best = km;
  }
  return best;
}

/** ¿Este Aliado encaja en la categoría POI? */
export function aliadoMatchesPoiKind(aliado: AliadoForPoi, kind: TomtomPoiKind): boolean {
  const giro = (aliado.pinGiro || "").toLowerCase();
  const blob = `${aliado.name} ${aliado.description || ""}`;
  switch (kind) {
    case "pharmacy":
      return giro === "farmacia" || /farmac|pharmacy|botica/i.test(blob);
    case "hospital":
      return /hospital|cl[ií]nic|m[eé]dic/i.test(blob);
    case "gas_station":
      return /gasolin|pemex|combustible|petrol/i.test(blob);
    case "ev_charging":
      return /cargador|carga\s*el[eé]ct|electrolinera|\bev\b/i.test(blob);
    case "toll":
      return /caseta|peaje|toll|plaza\s*de\s*cobro/i.test(blob);
    default:
      return false;
  }
}

export function tomtomDuplicatesAliado(
  tomtom: { name: string; lat: number; lng: number },
  aliado: { name: string; lat: number; lng: number },
  maxMeters = ALIADO_TOMTOM_DEDUPE_M,
): boolean {
  const meters = haversineKm(tomtom.lat, tomtom.lng, aliado.lat, aliado.lng) * 1000;
  if (meters > maxMeters) return false;
  return namesRoughlyMatch(tomtom.name, aliado.name) || meters <= 50;
}

/**
 * Aliados activos cerca del corredor van primero (badge + logo/promo);
 * TomTom después, sin duplicar el mismo lugar (~150 m + nombre).
 */
export function mergeAliadosIntoPois(opts: {
  tomtomPois: Record<string, Array<{ name: string; lat: number; lng: number; distKm: number }>>;
  aliados: AliadoForPoi[];
  samplePoints?: ReadonlyArray<{ lat: number; lng: number }>;
  maxAliadoKm?: number;
  limitPerKind?: number;
}): Record<string, TravelPoi[]> {
  const points = opts.samplePoints ?? [...TOMTOM_POI_SAMPLE_POINTS, ...CORRIDOR_FLOW_POINTS];
  const maxKm = opts.maxAliadoKm ?? ALIADO_CORRIDOR_MAX_KM;
  const limit = opts.limitPerKind ?? 5;
  const out: Record<string, TravelPoi[]> = {};

  for (const kind of Object.keys(TOMTOM_POI_CATEGORIES) as TomtomPoiKind[]) {
    const nearAliados = opts.aliados
      .map((a) => {
        const distKm = minKmToCorridor(a.lat, a.lng, points);
        return { a, distKm };
      })
      .filter(({ a, distKm }) => distKm <= maxKm && aliadoMatchesPoiKind(a, kind))
      .sort((x, y) => x.distKm - y.distKm);

    const aliadoRows: TravelPoi[] = nearAliados.map(({ a, distKm }) => ({
      id: a.id,
      name: a.name,
      lat: a.lat,
      lng: a.lng,
      distKm: Math.round(distKm * 10) / 10,
      source: "aliado" as const,
      aliado: true,
      badge: "Aliado Pulso",
      logoUrl: a.logoUrl ?? null,
      promo: (a.description || "").trim() || null,
    }));

    const tomtomRaw = opts.tomtomPois[kind] ?? [];
    const tomtomRows: TravelPoi[] = [];
    for (const t of tomtomRaw) {
      const dup = aliadoRows.some((al) =>
        tomtomDuplicatesAliado(t, { name: al.name, lat: al.lat, lng: al.lng }),
      );
      if (dup) continue;
      tomtomRows.push({
        name: t.name,
        lat: t.lat,
        lng: t.lng,
        distKm: t.distKm,
        source: "tomtom",
      });
    }

    out[kind] = [...aliadoRows, ...tomtomRows].slice(0, limit);
  }
  return out;
}

export const TOMTOM_NOTIFY_MAX_AGE_MINUTES = 30;
export const TOMTOM_NOTIFY_MAX_PER_USER = 2;
export const TOMTOM_CIRCULO_RADIUS_KM = 0.8;

export type ParsedBbox = {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
};

export function parseBbox(bbox: string): ParsedBbox | null {
  const parts = bbox.split(",").map((p) => Number(p.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [minLon, minLat, maxLon, maxLat] = parts;
  if (minLon >= maxLon || minLat >= maxLat) return null;
  return { minLon, minLat, maxLon, maxLat };
}

/** Área aproximada en km² (EPSG:4326 → equirectangular local). */
export function bboxAreaKm2(bbox: string): number {
  const b = parseBbox(bbox);
  if (!b) return Number.POSITIVE_INFINITY;
  const midLat = (b.minLat + b.maxLat) / 2;
  const kmPerDegLat = 111.32;
  const kmPerDegLon = 111.32 * Math.cos((midLat * Math.PI) / 180);
  return (b.maxLat - b.minLat) * kmPerDegLat * (b.maxLon - b.minLon) * kmPerDegLon;
}

export function pointInBbox(lat: number, lng: number, bbox: string): boolean {
  const b = parseBbox(bbox);
  if (!b) return false;
  return lng >= b.minLon && lng <= b.maxLon && lat >= b.minLat && lat <= b.maxLat;
}

export function bboxesOverlap(a: string, b: string): boolean {
  const A = parseBbox(a);
  const B = parseBbox(b);
  if (!A || !B) return false;
  return !(A.maxLon <= B.minLon || B.maxLon <= A.minLon || A.maxLat <= B.minLat || B.maxLat <= A.minLat);
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(x));
}

export function nearestActiveCity(lat: number, lng: number): {
  cityId: string;
  label: string;
} {
  let best: (typeof ACTIVE_CITY_CENTERS)[number] = ACTIVE_CITY_CENTERS[0];
  let bestKm = Infinity;
  for (const c of ACTIVE_CITY_CENTERS) {
    const km = haversineKm(lat, lng, c.lat, c.lng);
    if (km < bestKm) {
      bestKm = km;
      best = c;
    }
  }
  return { cityId: best.cityId, label: best.label };
}

/** city_id del incidente: caja de ciudad si cae dentro; si no, ciudad activa más cercana. */
export function cityIdForIncident(lat: number, lng: number): { cityId: string; label: string } {
  for (const box of TOMTOM_BBOXES) {
    if (box.cityId && pointInBbox(lat, lng, box.bbox)) {
      return { cityId: box.cityId, label: box.label };
    }
  }
  const near = nearestActiveCity(lat, lng);
  return { cityId: near.cityId, label: CITY_NAMES[near.cityId] || near.label };
}

/**
 * Fail-safe de despejado: solo si el punto cae en ≥1 bbox exitoso y el id
 * no apareció. Si no hubo éxitos → no despejar nada.
 */
export function selectIncidentsToResolve(opts: {
  active: Array<{ id: string; external_id: string; lat: number | null; lng: number | null }>;
  seenIds: Set<string>;
  successfulBboxes: string[];
}): string[] {
  if (opts.successfulBboxes.length === 0) return [];
  const out: string[] = [];
  for (const row of opts.active) {
    if (opts.seenIds.has(row.external_id)) continue;
    if (row.lat == null || row.lng == null || !Number.isFinite(row.lat) || !Number.isFinite(row.lng)) {
      continue;
    }
    const covered = opts.successfulBboxes.some((bbox) => pointInBbox(row.lat!, row.lng!, bbox));
    if (covered) out.push(row.id);
  }
  return out;
}

/** True si el incidente es “fresco” para push (startTime < maxAge). Sin start → fresco. */
export function isFreshTomtomIncident(
  startTime: string | null | undefined,
  nowMs = Date.now(),
  maxAgeMinutes = TOMTOM_NOTIFY_MAX_AGE_MINUTES,
): boolean {
  if (!startTime) return true;
  const t = Date.parse(startTime);
  if (!Number.isFinite(t)) return true;
  return nowMs - t <= maxAgeMinutes * 60_000;
}

export type TomtomNotifyCandidate = {
  postId: string;
  externalId: string;
  lat: number;
  lng: number;
  cityId: string;
  category: string;
  title: string;
  placeLabel: string;
  startTime?: string | null;
};

/**
 * Plan de pushes por usuario: ≤2 individuales; si hay más, 1 digest agregado.
 * `groups` = listas de candidatos (1 item = push simple; N>1 = digest).
 */
export function planTomtomNotifiesPerUser(
  items: TomtomNotifyCandidate[],
  maxIndividual = TOMTOM_NOTIFY_MAX_PER_USER,
): TomtomNotifyCandidate[][] {
  if (items.length === 0) return [];
  if (items.length <= maxIndividual) return items.map((i) => [i]);
  return [items];
}

export function isAllowedTravelPoint(p: { lat: number; lng: number }): boolean {
  if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return false;
  for (const box of TOMTOM_BBOXES) {
    if (pointInBbox(p.lat, p.lng, box.bbox)) return true;
  }
  for (const c of ACTIVE_CITY_CENTERS) {
    if (haversineKm(p.lat, p.lng, c.lat, c.lng) <= 35) return true;
  }
  for (const f of CORRIDOR_FLOW_POINTS) {
    if (haversineKm(p.lat, p.lng, f.lat, f.lng) <= 30) return true;
  }
  return false;
}

export function travelPresets(direction: string): {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
} {
  const cul = { lat: 24.8091, lng: -107.394 };
  const mzt = { lat: 23.2494, lng: -106.4111 };
  return direction === "mazatlan_to_culiacan"
    ? { origin: mzt, destination: cul }
    : { origin: cul, destination: mzt };
}

export function resolveTravelEndpoints(opts: {
  direction: string;
  origin?: { lat: number; lng: number } | null;
  destination?: { lat: number; lng: number } | null;
}): {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  originClamped: boolean;
  destinationClamped: boolean;
} {
  const presets = travelPresets(opts.direction);
  const originOk = opts.origin && isAllowedTravelPoint(opts.origin);
  const destOk = opts.destination && isAllowedTravelPoint(opts.destination);
  return {
    origin: originOk ? opts.origin! : presets.origin,
    destination: destOk ? opts.destination! : presets.destination,
    originClamped: Boolean(opts.origin) && !originOk,
    destinationClamped: Boolean(opts.destination) && !destOk,
  };
}

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
  incidentBboxes: TOMTOM_BBOXES.length,
  incidentIntervalMinutes: 20,
  estimatedIncidentRequestsPerDay: Math.ceil((24 * 60) / 20) * TOMTOM_BBOXES.length, // ~360 con 5 bbox
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

export type ParsedPoi = {
  name: string;
  lat: number;
  lng: number;
  distKm: number;
  categoryIds: number[];
  categories: string[];
};

export function parseNearbySearch(data: unknown): ParsedPoi[] {
  if (!data || typeof data !== "object") return [];
  const results = (data as {
    results?: Array<{
      poi?: {
        name?: string;
        categories?: string[];
        categorySet?: Array<{ id?: number }>;
        classifications?: Array<{ code?: string; names?: Array<{ name?: string }> }>;
      };
      position?: { lat?: number; lon?: number };
      dist?: number;
    }>;
  }).results;
  if (!Array.isArray(results)) return [];
  return results.slice(0, 8).map((r) => {
    const categoryIds = (r.poi?.categorySet ?? [])
      .map((c) => Number(c.id))
      .filter((id) => Number.isFinite(id));
    const categories = [
      ...(r.poi?.categories ?? []),
      ...((r.poi?.classifications ?? []).flatMap((c) => [
        c.code ?? "",
        ...(c.names ?? []).map((n) => n.name ?? ""),
      ])),
    ].filter(Boolean);
    return {
      name: r.poi?.name || "POI",
      lat: r.position?.lat ?? 0,
      lng: r.position?.lon ?? 0,
      distKm: Math.round(((r.dist || 0) / 1000) * 10) / 10,
      categoryIds,
      categories,
    };
  });
}
