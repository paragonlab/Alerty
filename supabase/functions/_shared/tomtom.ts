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

export const TOMTOM_POI_CACHE_KEY = "poi:corridor:v6";
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
/** Dedupe genérico TomTom↔TomTom: nombre similar + ~300 m. */
export const POI_DEDUPE_METERS = 300;
/** EV: mismo nombre normalizado dentro de ~2 km (Tesla duplicado ~1.1 km). */
export const EV_NAME_DEDUPE_METERS = 2000;
/** TomTom peaje solo si está a ≤1 km de una caseta curada. */
export const TOLL_NEAR_CURATED_KM = 1;

/**
 * Casetas del corredor (siempre visibles).
 * Costa Rica / Quilá / Mármol: SCT; libramiento Culiacán: OSM toll_booth ~24.749,-107.569.
 */
export const CURATED_MEX15D_TOLL_BOOTHS = [
  { name: "Caseta Costa Rica (MEX-15D)", lat: 24.5702, lng: -107.4302 },
  { name: "Caseta Quilá (MEX-15D)", lat: 24.3966, lng: -107.2719 },
  { name: "Caseta Mármol (MEX-15D)", lat: 23.4712, lng: -106.5695 },
  {
    name: "Caseta Libramiento Culiacán",
    lat: 24.7489,
    lng: -107.5686,
  },
] as const;

export type TomtomPoiKind = keyof typeof TOMTOM_POI_CATEGORIES;

/** Pistas de categoría para filtrar falsos positivos (p. ej. taller como hospital). */
export const TOMTOM_POI_CATEGORY_HINTS: Record<
  TomtomPoiKind,
  { ids: number[]; nameRe: RegExp; rejectRe?: RegExp }
> = {
  gas_station: {
    ids: [7311],
    nameRe: /petrol|gasolin|combustible|pemex|shell|bp\b|mobil|fuel\s*station/i,
    rejectRe:
      /electric|ev\s*charg|carga\s*el[eé]ctrica|cargador|taller|mec[aá]nic|refaccion|llantera|vulcaniz|auto\s*parts|car\s*repair|reparaci[oó]n/i,
  },
  ev_charging: {
    ids: [7309],
    nameRe: /electric|ev\s*charg|carga\s*el[eé]ctrica|cargador|electrolinera/i,
    rejectRe: /petrol|gasolin|pemex(?!\s*ev)/i,
  },
  hospital: {
    ids: [7321],
    nameRe: /hospital|cl[ií]nic|polyclinic|m[eé]dic/i,
    rejectRe: /taller|mec[aá]nic|vulcaniz|refaccion|llantera|auto\s*parts|car\s*repair/i,
  },
  pharmacy: {
    ids: [7326],
    nameRe: /farmac|pharmacy|dispensar|botica/i,
  },
  toll: {
    ids: [7375],
    nameRe: /caseta|toll\s*gate|toll\s*plaza|plaza\s*de\s*cobro|peaje/i,
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

/** Clasificación / categoría TomTom que suena a peaje (no solo el id del search). */
export function hasTollClassification(categories: string[]): boolean {
  return categories.some((c) =>
    /toll\s*gate|toll\s*plaza|caseta|peaje|plaza\s*de\s*cobro|7375/i.test(c),
  );
}

/** Nombres genéricos que TomTom a veces atribuye a peajes (ciudad / placeholder). */
export function isGenericTollName(name: string): boolean {
  const n = normalizePoiName(name);
  if (!n || n === "poi") return true;
  return /^(culiacan|culiacan rosales|mazatlan|sinaloa|mexico)$/.test(n);
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
  const name = poi.name ?? "";
  const categories = poi.categories ?? [];
  const blob = [...categories, name].join(" ");
  if (hint.rejectRe?.test(blob)) return false;

  const ids = poi.categoryIds ?? [];
  const hasCategory = ids.some((id) =>
    hint.ids.some((exp) => categoryIdMatches(exp, id)),
  );
  const nameLooksLikeToll = hint.nameRe.test(name);
  const hasNameHint = nameLooksLikeToll || hint.nameRe.test(blob);

  if (kind === "toll") {
    // Nombres genéricos (ciudad / "POI") nunca; hace falta caseta/plaza/peaje
    // en el nombre, o categoría/clasificación de peaje con un nombre útil.
    if (isGenericTollName(name)) return false;
    if (nameLooksLikeToll) return true;
    return hasCategory || hasTollClassification(categories);
  }

  if (kind === "gas_station") {
    // Solo petrol (7311) vía categorySet; sin ids, nombre de gasolinera.
    // Talleres ya caen por rejectRe (taller/mecánico/refacciones/llantera).
    if (ids.length > 0) return hasCategory;
    return hasNameHint;
  }

  if (ids.length > 0) return hasCategory;
  return hasNameHint;
}

/** Mismo POI si nombre similar y distancia ≤ maxMeters. */
export function poisNearDuplicate(
  a: { name: string; lat: number; lng: number },
  b: { name: string; lat: number; lng: number },
  maxMeters = POI_DEDUPE_METERS,
): boolean {
  const meters = haversineKm(a.lat, a.lng, b.lat, b.lng) * 1000;
  if (meters > maxMeters) return false;
  return namesRoughlyMatch(a.name, b.name);
}

/** Coords idénticas (gas duplicado en el mismo punto). */
export function sameCoords(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): boolean {
  return a.lat === b.lat && a.lng === b.lng;
}

export function sameNormalizedName(a: string, b: string): boolean {
  const na = normalizePoiName(a);
  const nb = normalizePoiName(b);
  return Boolean(na) && na === nb;
}

/** ¿Nombre de peaje real (caseta / plaza de cobro)? */
export function nameHasCasetaOrPlaza(name: string): boolean {
  return /caseta|plaza\s*de\s*cobro/i.test(name);
}

export function isNearCuratedToll(
  lat: number,
  lng: number,
  maxKm = TOLL_NEAR_CURATED_KM,
): boolean {
  return CURATED_MEX15D_TOLL_BOOTHS.some(
    (b) => haversineKm(lat, lng, b.lat, b.lng) <= maxKm,
  );
}

/**
 * Dedupe por categoría:
 * - EV: mismo nombre normalizado ≤ ~2 km
 * - gas: mismo nombre normalizado + coords idénticas
 * - resto: nombre similar ≤ ~300 m
 */
export function dedupePoisByNamePos<T extends { name: string; lat: number; lng: number }>(
  items: T[],
  limit = 5,
  kind?: TomtomPoiKind,
): T[] {
  const out: T[] = [];
  for (const p of items) {
    const dup = out.some((kept) => {
      if (kind === "ev_charging") {
        if (!sameNormalizedName(kept.name, p.name)) return false;
        return haversineKm(kept.lat, kept.lng, p.lat, p.lng) * 1000 <= EV_NAME_DEDUPE_METERS;
      }
      if (kind === "gas_station") {
        return sameNormalizedName(kept.name, p.name) && sameCoords(kept, p);
      }
      return poisNearDuplicate(kept, p, POI_DEDUPE_METERS);
    });
    if (dup) continue;
    out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}

function curatedTollRows(): Array<{ name: string; lat: number; lng: number; distKm: number }> {
  return CURATED_MEX15D_TOLL_BOOTHS.map((b) => ({
    name: b.name,
    lat: b.lat,
    lng: b.lng,
    distKm: Math.round(minKmToCorridor(b.lat, b.lng) * 10) / 10,
  }));
}

/**
 * Siempre muestra casetas curadas; solo añade TomTom si está ≤1 km de una
 * curada o el nombre trae «caseta» / «plaza de cobro», dedupeado vs curadas.
 * @deprecated Usar mergeCuratedTolls — se mantiene alias por claridad en diffs.
 */
export function withCuratedTollFallback<
  T extends { name: string; lat: number; lng: number; distKm: number },
>(items: T[]): Array<T | { name: string; lat: number; lng: number; distKm: number }> {
  return mergeCuratedTolls(items);
}

/** Casetas curadas primero + TomTom filtrado (nunca Navolato / Concordia sueltos). */
export function mergeCuratedTolls<
  T extends { name: string; lat: number; lng: number; distKm: number },
>(tomtomItems: T[]): Array<T | { name: string; lat: number; lng: number; distKm: number }> {
  const curated = curatedTollRows();
  const extras: T[] = [];
  for (const t of tomtomItems) {
    const near = isNearCuratedToll(t.lat, t.lng);
    const named = nameHasCasetaOrPlaza(t.name);
    if (!near && !named) continue;
    const dupCurated = curated.some((c) => {
      const km = haversineKm(t.lat, t.lng, c.lat, c.lng);
      if (km <= TOLL_NEAR_CURATED_KM) return true;
      return sameNormalizedName(t.name, c.name) || namesRoughlyMatch(t.name, c.name);
    });
    if (dupCurated) continue;
    if (extras.some((e) => poisNearDuplicate(e, t, EV_NAME_DEDUPE_METERS))) continue;
    extras.push(t);
  }
  return [...curated, ...extras];
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
  kind?: TomtomPoiKind,
): T[] {
  const queues = bySample.map((list) => [...list]);
  const flat: T[] = [];
  let progressed = true;
  while (flat.length < limit * 3 && progressed) {
    progressed = false;
    for (const q of queues) {
      while (q.length > 0) {
        const p = q.shift()!;
        flat.push(p);
        progressed = true;
        break;
      }
      if (flat.length >= limit * 3) break;
    }
  }
  return dedupePoisByNamePos(flat, limit, kind);
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

/**
 * Endpoints de viaje.
 * - Con origin+destination en México y ≤1500 km: se usan tal cual.
 * - Sin coords / inválidos: cae al preset del corredor (compat chips CUL↔MZT).
 */
export function resolveTravelEndpoints(opts: {
  direction: string;
  origin?: { lat: number; lng: number } | null;
  destination?: { lat: number; lng: number } | null;
  /** Si true, exige México (no solo corredor). Default true cuando hay ambas coords. */
  mexicoWide?: boolean;
}): {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  originClamped: boolean;
  destinationClamped: boolean;
  error?: string;
  distanceKm?: number;
} {
  const presets = travelPresets(opts.direction);
  const hasBoth = Boolean(opts.origin && opts.destination);
  const mexicoWide = opts.mexicoWide ?? hasBoth;

  if (mexicoWide && opts.origin && opts.destination) {
    const v = validateTripEndpoints(opts.origin, opts.destination);
    if (!v.ok) {
      return {
        origin: presets.origin,
        destination: presets.destination,
        originClamped: true,
        destinationClamped: true,
        error: v.error,
        distanceKm: v.distanceKm,
      };
    }
    return {
      origin: opts.origin,
      destination: opts.destination,
      originClamped: false,
      destinationClamped: false,
      distanceKm: v.distanceKm,
    };
  }

  const originOk = opts.origin && isAllowedTravelPoint(opts.origin);
  const destOk = opts.destination && isAllowedTravelPoint(opts.destination);
  return {
    origin: originOk ? opts.origin! : presets.origin,
    destination: destOk ? opts.destination! : presets.destination,
    originClamped: Boolean(opts.origin) && !originOk,
    destinationClamped: Boolean(opts.destination) && !destOk,
  };
}

/**
 * Contornos simplificados (WGS84): continental + península de Baja.
 * Excluye El Paso, San Diego y Guatemala City.
 */
export const MEXICO_MAINLAND_POLYGON: ReadonlyArray<{ lat: number; lng: number }> = [
  { lat: 32.50, lng: -114.80 },
  { lat: 31.80, lng: -113.00 },
  { lat: 31.33, lng: -109.05 },
  { lat: 31.72, lng: -108.20 }, // S de El Paso
  { lat: 31.72, lng: -106.40 },
  { lat: 29.90, lng: -104.60 },
  { lat: 28.00, lng: -102.00 },
  { lat: 26.40, lng: -99.10 },
  { lat: 25.85, lng: -97.35 },
  { lat: 22.20, lng: -97.80 },
  { lat: 19.00, lng: -96.00 },
  { lat: 18.20, lng: -94.40 },
  { lat: 18.50, lng: -92.50 },
  { lat: 18.60, lng: -90.50 },
  { lat: 19.50, lng: -87.80 },
  { lat: 20.40, lng: -87.00 },
  { lat: 21.30, lng: -86.70 }, // E de Cancún
  { lat: 21.60, lng: -87.50 },
  { lat: 21.50, lng: -89.00 }, // N de Mérida
  { lat: 21.20, lng: -90.20 },
  { lat: 19.80, lng: -90.60 },
  { lat: 18.20, lng: -91.00 },
  { lat: 17.20, lng: -91.20 }, // N de Guatemala City
  { lat: 16.20, lng: -91.70 },
  { lat: 15.00, lng: -92.20 },
  { lat: 14.53, lng: -92.28 }, // Tapachula
  { lat: 15.80, lng: -96.20 },
  { lat: 16.80, lng: -99.90 },
  { lat: 18.00, lng: -102.80 },
  { lat: 20.80, lng: -105.40 },
  { lat: 23.50, lng: -106.60 },
  { lat: 25.80, lng: -109.20 },
  { lat: 29.00, lng: -112.50 },
  { lat: 31.50, lng: -114.70 },
  { lat: 32.50, lng: -114.80 },
];

export const MEXICO_BAJA_POLYGON: ReadonlyArray<{ lat: number; lng: number }> = [
  { lat: 32.55, lng: -117.15 }, // Tijuana (S de San Diego 32.72)
  { lat: 32.50, lng: -116.00 },
  { lat: 32.40, lng: -114.85 },
  { lat: 30.50, lng: -114.60 },
  { lat: 28.00, lng: -113.80 },
  { lat: 26.00, lng: -112.00 },
  { lat: 24.00, lng: -110.80 },
  { lat: 22.85, lng: -109.85 }, // Cabo
  { lat: 23.80, lng: -110.50 },
  { lat: 26.00, lng: -112.30 },
  { lat: 28.50, lng: -114.60 },
  { lat: 30.50, lng: -116.00 },
  { lat: 32.00, lng: -116.90 },
  { lat: 32.55, lng: -117.15 },
];

/** Unión de contornos (compat tests / docs). */
export const MEXICO_POLYGON = MEXICO_MAINLAND_POLYGON;

/** Prefiltro bbox barato antes del polígono. */
export const MEXICO_BOUNDS = {
  minLat: 14.4,
  maxLat: 32.75,
  minLng: -117.3,
  maxLng: -86.7,
} as const;

export const MAX_TRIP_LENGTH_KM = 1500;
/** Rejilla ~1.1 km (2 decimales) para cache de ruta/POI. */
export const TRIP_COORD_GRID_DECIMALS = 2;
export const ROUTE_CACHE_TTL_SEC = 10 * 60;
export const TRIP_POI_CACHE_TTL_SEC = 6 * 3600;
/** Espaciado de muestras POI/flow a lo largo de la polilínea (40–60 km). */
export const POI_SAMPLE_SPACING_KM = 50;
/** Preset MEX-15D: más muestras. */
export const POI_MAX_SAMPLES = 6;
export const FLOW_MAX_SAMPLES = 6;
/** Viajes libres: cupo bajo. */
export const NON_PRESET_POI_SAMPLES = 4;
export const NON_PRESET_FLOW_SAMPLES = 4;
export const NON_PRESET_POI_KINDS: TomtomPoiKind[] = [
  "gas_station",
  "hospital",
  "toll",
];
/** Incluir EV en no-preset solo si el gasto diario va holgado. */
export const EV_BUDGET_SOFT_CAP = 1200;
/** Tope diario non-tile para POI/flow de viajes no-preset. */
export const TOMTOM_DAILY_NON_PRESET_CAP = 1800;
export const PULSE_ROUTE_BUFFER_KM = 2;
export const PLACES_QUERY_MAX_LEN = 64;

export const TOMTOM_PLACES_RATE = {
  windowSeconds: 5 * 60,
  maxPerIp: 40,
  maxPerUser: 60,
} as const;

export type TripPlace = {
  name: string;
  lat: number;
  lng: number;
  municipality?: string | null;
};

/** Chips rápidos Sinaloa / oeste (coords centro ciudad). */
export const TRIP_ROUTE_CHIPS = [
  {
    id: "culiacan_mazatlan",
    label: "Culiacán – Mazatlán",
    origin: { name: "Culiacán", lat: 24.8091, lng: -107.394 },
    destination: { name: "Mazatlán", lat: 23.2494, lng: -106.4111 },
    knownCorridor: "mex15d" as const,
  },
  {
    id: "culiacan_los_mochis",
    label: "Culiacán – Los Mochis",
    origin: { name: "Culiacán", lat: 24.8091, lng: -107.394 },
    destination: { name: "Los Mochis", lat: 25.7903, lng: -108.9859 },
    knownCorridor: null,
  },
  {
    id: "mazatlan_tepic",
    label: "Mazatlán – Tepic",
    origin: { name: "Mazatlán", lat: 23.2494, lng: -106.4111 },
    destination: { name: "Tepic", lat: 21.5041, lng: -104.8946 },
    knownCorridor: null,
  },
  {
    id: "culiacan_guadalajara",
    label: "Culiacán – Guadalajara",
    origin: { name: "Culiacán", lat: 24.8091, lng: -107.394 },
    destination: { name: "Guadalajara", lat: 20.6597, lng: -103.3496 },
    knownCorridor: null,
  },
] as const;

/** Ray casting (lng = x, lat = y). Omite aristas horizontales. */
export function pointInPolygon(
  lat: number,
  lng: number,
  polygon: ReadonlyArray<{ lat: number; lng: number }>,
): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const yi = polygon[i]!.lat;
    const xi = polygon[i]!.lng;
    const yj = polygon[j]!.lat;
    const xj = polygon[j]!.lng;
    if (yi === yj) continue;
    const intersect =
      (yi > lat) !== (yj > lat) &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function isInMexico(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (
    lat < MEXICO_BOUNDS.minLat ||
    lat > MEXICO_BOUNDS.maxLat ||
    lng < MEXICO_BOUNDS.minLng ||
    lng > MEXICO_BOUNDS.maxLng
  ) {
    return false;
  }
  return (
    pointInPolygon(lat, lng, MEXICO_MAINLAND_POLYGON) ||
    pointInPolygon(lat, lng, MEXICO_BAJA_POLYGON)
  );
}

/** Modo viaje: nunca incluir operativo (ni con delay). */
export function isTravelCommunityRowAllowed(row: {
  category_guess?: string | null;
  category?: string | null;
}): boolean {
  const cat = String(row.category_guess ?? row.category ?? "").toLowerCase();
  return cat !== "operativo";
}

export function dailyTomtomBudgetKey(dayIso = new Date().toISOString().slice(0, 10)): string {
  return `budget:tomtom:non_preset:${dayIso}`;
}

export function tripPoiKindsForBudget(opts: {
  preset: boolean;
  dailyCount: number;
}): TomtomPoiKind[] {
  if (opts.preset) {
    return Object.keys(TOMTOM_POI_CATEGORIES) as TomtomPoiKind[];
  }
  const kinds = [...NON_PRESET_POI_KINDS];
  if (opts.dailyCount < EV_BUDGET_SOFT_CAP) {
    kinds.push("ev_charging");
  }
  return kinds;
}

export function roundCoordGrid(
  value: number,
  decimals = TRIP_COORD_GRID_DECIMALS,
): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

export function tripCacheKey(
  kind: "route" | "poi" | "flow",
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): string {
  const o = `${roundCoordGrid(origin.lat)},${roundCoordGrid(origin.lng)}`;
  const d = `${roundCoordGrid(destination.lat)},${roundCoordGrid(destination.lng)}`;
  return `${kind}:trip:v1:${o}:${d}`;
}

export function validateTripEndpoints(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): { ok: true; distanceKm: number } | { ok: false; error: string; distanceKm?: number } {
  if (!isInMexico(origin.lat, origin.lng) || !isInMexico(destination.lat, destination.lng)) {
    return { ok: false, error: "outside_mexico" };
  }
  const distanceKm = haversineKm(origin.lat, origin.lng, destination.lat, destination.lng);
  if (distanceKm > MAX_TRIP_LENGTH_KM) {
    return { ok: false, error: "too_far", distanceKm };
  }
  if (distanceKm < 0.3) {
    return { ok: false, error: "too_short", distanceKm };
  }
  return { ok: true, distanceKm };
}

/** ¿Parece el corredor Culiacán↔Mazatlán? (para casetas curadas). */
export function isKnownMex15dTrip(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): boolean {
  const cul = { lat: 24.8091, lng: -107.394 };
  const mzt = { lat: 23.2494, lng: -106.4111 };
  const near = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
    haversineKm(a.lat, a.lng, b.lat, b.lng) <= 25;
  return (
    (near(origin, cul) && near(destination, mzt)) ||
    (near(origin, mzt) && near(destination, cul))
  );
}

/**
 * Muestrea puntos a lo largo de una polilínea (~spacingKm, máx maxSamples).
 * Siempre incluye inicio y fin.
 */
export function sampleAlongPolyline(
  points: ReadonlyArray<{ lat: number; lng: number }>,
  spacingKm = POI_SAMPLE_SPACING_KM,
  maxSamples = POI_MAX_SAMPLES,
): Array<{ lat: number; lng: number; distKm: number }> {
  if (points.length === 0) return [];
  if (points.length === 1) {
    return [{ lat: points[0].lat, lng: points[0].lng, distKm: 0 }];
  }
  const out: Array<{ lat: number; lng: number; distKm: number }> = [];
  let traveled = 0;
  let nextAt = 0;
  out.push({ lat: points[0].lat, lng: points[0].lng, distKm: 0 });
  nextAt = spacingKm;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const cur = points[i]!;
    const seg = haversineKm(prev.lat, prev.lng, cur.lat, cur.lng);
    const segStart = traveled;
    traveled += seg;
    while (nextAt <= traveled + 1e-9 && out.length < maxSamples - 1) {
      const t = seg > 0 ? (nextAt - segStart) / seg : 0;
      const lat = prev.lat + (cur.lat - prev.lat) * Math.min(1, Math.max(0, t));
      const lng = prev.lng + (cur.lng - prev.lng) * Math.min(1, Math.max(0, t));
      out.push({ lat, lng, distKm: Math.round(nextAt * 10) / 10 });
      nextAt += spacingKm;
    }
  }
  const last = points[points.length - 1]!;
  if (
    out.length < maxSamples &&
    (out[out.length - 1]!.lat !== last.lat || out[out.length - 1]!.lng !== last.lng)
  ) {
    out.push({ lat: last.lat, lng: last.lng, distKm: Math.round(traveled * 10) / 10 });
  }
  return out.slice(0, maxSamples);
}

/** Distancia mínima a una polilínea (km). */
export function minKmToPolyline(
  lat: number,
  lng: number,
  line: ReadonlyArray<{ lat: number; lng: number }>,
): number {
  if (line.length === 0) return Infinity;
  if (line.length === 1) return haversineKm(lat, lng, line[0].lat, line[0].lng);
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    // Aprox: distancia a extremos + punto medio (suficiente para buffer 2 km)
    const d = Math.min(
      haversineKm(lat, lng, a.lat, a.lng),
      haversineKm(lat, lng, b.lat, b.lng),
      haversineKm(lat, lng, (a.lat + b.lat) / 2, (a.lng + b.lng) / 2),
    );
    if (d < best) best = d;
  }
  return best;
}

export function parseFuzzySearch(data: unknown): TripPlace[] {
  if (!data || typeof data !== "object") return [];
  const results = (data as {
    results?: Array<{
      type?: string;
      address?: {
        freeformAddress?: string;
        municipality?: string;
        countryCode?: string;
      };
      position?: { lat?: number; lon?: number };
      poi?: { name?: string };
    }>;
  }).results;
  if (!Array.isArray(results)) return [];
  const out: TripPlace[] = [];
  for (const r of results) {
    const lat = r.position?.lat;
    const lng = r.position?.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (!isInMexico(lat!, lng!)) continue;
    const name =
      r.poi?.name ||
      r.address?.freeformAddress ||
      r.address?.municipality ||
      "Lugar";
    out.push({
      name: String(name).slice(0, 120),
      lat: lat!,
      lng: lng!,
      municipality: r.address?.municipality ?? null,
    });
    if (out.length >= 6) break;
  }
  return out;
}

/** Recorta a 64 chars antes de cachear / buscar. */
export function normalizePlacesQuery(query: string): string {
  return String(query || "").trim().slice(0, PLACES_QUERY_MAX_LEN);
}

export function placesCacheKey(query: string): string {
  const q = normalizePlacesQuery(query)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .trim()
    .replace(/\s+/g, "_");
  return `places:mx:v1:${q}`;
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

/**
 * IP confiable para rate limit: header de plataforma, o el último hop de
 * x-forwarded-for (el que añade el edge / proxy de confianza).
 */
export function clientIpFromHeaders(headers: Headers): string {
  const cf = headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf.slice(0, 64);
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 64);
  const vercel = headers.get("x-vercel-forwarded-for")?.trim();
  if (vercel) {
    const parts = vercel.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1]!.slice(0, 64);
  }
  const xf = headers.get("x-forwarded-for") || "";
  const hops = xf.split(",").map((s) => s.trim()).filter(Boolean);
  if (hops.length) return hops[hops.length - 1]!.slice(0, 64);
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
  points: Array<{ lat: number; lng: number }>;
  alternates: Array<{
    summary: string;
    travelTimeMinutes: number;
    trafficDelayMinutes: number;
  }>;
};

export function extractRoutePoints(data: unknown): Array<{ lat: number; lng: number }> {
  if (!data || typeof data !== "object") return [];
  const routes = (data as {
    routes?: Array<{
      legs?: Array<{
        points?: Array<{ latitude?: number; longitude?: number }>;
      }>;
    }>;
  }).routes;
  const legs = routes?.[0]?.legs;
  if (!Array.isArray(legs)) return [];
  const out: Array<{ lat: number; lng: number }> = [];
  for (const leg of legs) {
    for (const p of leg.points ?? []) {
      const lat = Number(p.latitude);
      const lng = Number(p.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) out.push({ lat, lng });
    }
  }
  return out;
}

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
    points: extractRoutePoints(data),
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
