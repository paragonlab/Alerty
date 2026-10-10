/**
 * Insights de Modo viaje: ruta con tráfico, tramos lentos, POI y pulsos cerca
 * de la polilínea. Origen/destino libres dentro de México (≤1500 km).
 * Cache en tomtom_cache. Mock si falta TOMTOM_API_KEY.
 *
 * POST body: {
 *   origin: {lat,lng,name?}, destination: {lat,lng,name?},
 *   direction?: legacy preset, fromLabel?, window?: "6h"|"24h",
 *   smoke?: boolean  // solo service role
 * }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { CITY_IDS } from "../_shared/cities.ts";
import {
  CORRIDOR_FLOW_POINTS,
  CURATED_MEX15D_TOLL_BOOTHS,
  FLOW_MAX_SAMPLES,
  POI_MAX_SAMPLES,
  POI_SAMPLE_SPACING_KM,
  PULSE_ROUTE_BUFFER_KM,
  ROUTE_CACHE_TTL_SEC,
  TOMTOM_ATTRIBUTION,
  TOMTOM_BUDGET,
  TOMTOM_POI_CATEGORIES,
  TOMTOM_POI_MAX_RADIUS_M,
  TOMTOM_POI_REQUEST_GAP_MS,
  TOMTOM_POI_RETRY_BACKOFF_MS,
  TOMTOM_TRAVEL_RATE,
  TRIP_POI_CACHE_TTL_SEC,
  clientIpFromHeaders,
  dedupePoisByNamePos,
  extraMinutesFromFlow,
  isKnownMex15dTrip,
  mergeAliadosIntoPois,
  mergeCuratedTolls,
  minKmToPolyline,
  parseCalculateRoute,
  parseNearbySearch,
  poiMatchesExpectedCategory,
  rateLimitBucket,
  rateLimitCacheKey,
  resolveTravelEndpoints,
  sampleAlongPolyline,
  tomtomGetJson,
  tomtomKey,
  tripCacheKey,
  type AliadoForPoi,
  type TomtomPoiKind,
  type TravelPoi,
} from "../_shared/tomtom.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

type LatLng = { lat: number; lng: number };

const CUL: LatLng = { lat: 24.8091, lng: -107.394 };
const MZT: LatLng = { lat: 23.2494, lng: -106.4111 };

async function cacheGet(
  admin: ReturnType<typeof createClient>,
  key: string,
): Promise<unknown | null> {
  const { data } = await admin
    .from("tomtom_cache")
    .select("payload,expires_at")
    .eq("cache_key", key)
    .maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return data.payload;
}

async function cacheSet(
  admin: ReturnType<typeof createClient>,
  key: string,
  kind: string,
  payload: unknown,
  ttlSeconds: number,
) {
  const expires = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  await admin.from("tomtom_cache").upsert({
    cache_key: key,
    kind,
    payload,
    expires_at: expires,
    updated_at: new Date().toISOString(),
  });
}

async function consumeRateLimit(
  admin: ReturnType<typeof createClient>,
  kind: "ip" | "user",
  id: string,
  max: number,
): Promise<{ ok: boolean; count: number }> {
  const bucket = rateLimitBucket();
  const key = rateLimitCacheKey(kind, id, bucket);
  const cached = await cacheGet(admin, key);
  const count = Number((cached as { count?: number } | null)?.count) || 0;
  if (count >= max) return { ok: false, count };
  const next = count + 1;
  await cacheSet(admin, key, "ratelimit", { count: next }, TOMTOM_TRAVEL_RATE.windowSeconds);
  return { ok: true, count: next };
}

function mockInsights(opts: {
  origin: LatLng;
  destination: LatLng;
  originName?: string;
  destinationName?: string;
}) {
  const known = isKnownMex15dTrip(opts.origin, opts.destination);
  return {
    mock: true,
    attribution: TOMTOM_ATTRIBUTION,
    budget: TOMTOM_BUDGET,
    delays: known
      ? [
        { id: "elota", label: "cerca de Elota", extraMinutes: 12 },
        { id: "dimas", label: "cerca de Dimas", extraMinutes: 5 },
      ]
      : [{ id: "tramo", label: "en el camino", extraMinutes: 8 }],
    route: {
      source: "mock",
      summary: known
        ? "México 15D · con tráfico (demo)"
        : "Ruta con tráfico (demo)",
      travelTimeMinutes: known ? 168 : 120,
      trafficDelayMinutes: known ? 18 : 10,
      lengthKm: known ? 218 : 150,
      points: [opts.origin, opts.destination],
      alternates: known
        ? [{ summary: "México 15 libre", travelTimeMinutes: 195, trafficDelayMinutes: 10 }]
        : [],
      origin: opts.origin,
      destination: opts.destination,
    },
    pois: mockPois(known),
    pulses: [],
    originName: opts.originName || null,
    destinationName: opts.destinationName || null,
  };
}

function mockPois(known: boolean): Record<string, TravelPoi[]> {
  const base: Record<string, TravelPoi[]> = {
    gas_station: [
      {
        name: "Gasolinera demo",
        lat: 24.55,
        lng: -107.44,
        distKm: 0.4,
        source: "tomtom",
      },
    ],
    ev_charging: [
      {
        name: "Cargador demo",
        lat: 23.95,
        lng: -107.02,
        distKm: 0.5,
        source: "tomtom",
      },
    ],
    hospital: [
      {
        name: "Hospital demo",
        lat: 23.3,
        lng: -106.36,
        distKm: 1.2,
        source: "tomtom",
      },
    ],
    pharmacy: [
      {
        name: "Farmacia Aliada",
        lat: 23.72,
        lng: -106.78,
        distKm: 0.8,
        source: "aliado",
        aliado: true,
        badge: "Aliado Pulso",
        promo: "Descuento a vecinos Pulso",
        logoUrl: null,
      },
    ],
    toll: known
      ? CURATED_MEX15D_TOLL_BOOTHS.slice(0, 3).map((b) => ({
        name: b.name,
        lat: b.lat,
        lng: b.lng,
        distKm: 0.2,
        source: "tomtom" as const,
      }))
      : [
        {
          name: "Caseta demo",
          lat: 24.4,
          lng: -107.4,
          distKm: 0.2,
          source: "tomtom",
        },
      ],
  };
  return base;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tomtomPoiGet(
  path: string,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  let res = await tomtomGetJson(path);
  if (res.status === 429) {
    await sleep(TOMTOM_POI_RETRY_BACKOFF_MS);
    res = await tomtomGetJson(path);
  }
  if (!res.ok) {
    console.warn("tomtom POI non-200", res.status, path.slice(0, 120));
  }
  return res;
}

async function fetchRoute(
  admin: ReturnType<typeof createClient>,
  origin: LatLng,
  destination: LatLng,
  skipCache = false,
): Promise<{
  source: string;
  summary: string;
  travelTimeMinutes: number | null;
  trafficDelayMinutes: number | null;
  lengthKm: number | null;
  points: LatLng[];
  alternates: Array<{
    summary: string;
    travelTimeMinutes: number;
    trafficDelayMinutes: number;
  }>;
  origin: LatLng;
  destination: LatLng;
} | null> {
  const key = tripCacheKey("route", origin, destination);
  if (!skipCache) {
    const cached = await cacheGet(admin, key);
    if (cached && typeof cached === "object") {
      return cached as {
        source: string;
        summary: string;
        travelTimeMinutes: number | null;
        trafficDelayMinutes: number | null;
        lengthKm: number | null;
        points: LatLng[];
        alternates: Array<{
          summary: string;
          travelTimeMinutes: number;
          trafficDelayMinutes: number;
        }>;
        origin: LatLng;
        destination: LatLng;
      };
    }
  }

  const path =
    `/routing/1/calculateRoute/${origin.lat},${origin.lng}:${destination.lat},${destination.lng}/json` +
    `?traffic=true&travelMode=car&routeType=fastest&maxAlternatives=1&language=es-ES`;
  const { ok, data } = await tomtomGetJson(path);
  if (!ok || !data) return null;

  const parsed = parseCalculateRoute(data);
  if (!parsed) return null;
  let points = parsed.points;
  if (points.length < 2) {
    points = [origin, destination];
  }
  if (parsed.lengthKm != null && parsed.lengthKm > 1500) {
    return null; // rechazo por longitud real de ruta
  }
  const payload = {
    source: "tomtom",
    summary: parsed.summary,
    travelTimeMinutes: parsed.travelTimeMinutes,
    trafficDelayMinutes: parsed.trafficDelayMinutes,
    lengthKm: parsed.lengthKm,
    points,
    alternates: parsed.alternates,
    origin,
    destination,
  };
  await cacheSet(admin, key, "route", payload, ROUTE_CACHE_TTL_SEC);
  return payload;
}

async function fetchFlowAlongRoute(
  admin: ReturnType<typeof createClient>,
  origin: LatLng,
  destination: LatLng,
  polyline: LatLng[],
  skipCache = false,
): Promise<Array<{ id: string; label: string; extraMinutes: number }>> {
  const cacheKey = tripCacheKey("flow", origin, destination);
  if (!skipCache) {
    const cached = await cacheGet(admin, cacheKey);
    if (cached && Array.isArray((cached as { delays?: unknown }).delays)) {
      return (cached as { delays: Array<{ id: string; label: string; extraMinutes: number }> })
        .delays;
    }
  }

  const samples = sampleAlongPolyline(polyline, POI_SAMPLE_SPACING_KM, FLOW_MAX_SAMPLES);
  const points = samples.length >= 2
    ? samples
    : isKnownMex15dTrip(origin, destination)
    ? CORRIDOR_FLOW_POINTS.map((p) => ({ lat: p.lat, lng: p.lng, distKm: 0 }))
    : [{ ...origin, distKm: 0 }, { ...destination, distKm: 0 }];

  const delays: Array<{ id: string; label: string; extraMinutes: number }> = [];
  for (let i = 0; i < points.length; i++) {
    if (i > 0) await sleep(TOMTOM_POI_REQUEST_GAP_MS);
    const p = points[i]!;
    const path =
      `/traffic/services/4/flowSegmentData/relative/10/json?point=${p.lat},${p.lng}&unit=KMPH`;
    const { ok, data } = await tomtomGetJson(path);
    if (!ok || !data) continue;
    const extra = extraMinutesFromFlow(data);
    if (extra >= 3) {
      delays.push({
        id: `km${Math.round(p.distKm || i * 50)}`,
        label: p.distKm
          ? `cerca del km ${Math.round(p.distKm)}`
          : "en el camino",
        extraMinutes: extra,
      });
    }
  }

  await cacheSet(admin, cacheKey, "flow", { delays }, ROUTE_CACHE_TTL_SEC);
  return delays;
}

async function loadActiveAliados(
  admin: ReturnType<typeof createClient>,
): Promise<AliadoForPoi[]> {
  const { data, error } = await admin
    .from("sponsored_zones")
    .select("id,name,description,lat,lng,logo_url,pin_giro,type,status")
    .eq("status", "active")
    .limit(200);
  if (error || !data) {
    if (error) console.warn("aliados load", error.message);
    return [];
  }
  return data.map((row) => ({
    id: row.id as string,
    name: String(row.name || ""),
    description: (row.description as string) || null,
    lat: Number(row.lat),
    lng: Number(row.lng),
    logoUrl: (row.logo_url as string) || null,
    pinGiro: (row.pin_giro as string) || null,
    type: (row.type as string) || null,
  })).filter((a) => Number.isFinite(a.lat) && Number.isFinite(a.lng) && a.name);
}

async function fetchPoisAlongRoute(
  admin: ReturnType<typeof createClient>,
  origin: LatLng,
  destination: LatLng,
  polyline: LatLng[],
  skipCache = false,
): Promise<Record<string, TravelPoi[]>> {
  const cacheKey = tripCacheKey("poi", origin, destination);
  if (!skipCache) {
    const cached = await cacheGet(admin, cacheKey);
    if (cached && typeof cached === "object") {
      const tomtom = cached as Record<
        string,
        Array<{ name: string; lat: number; lng: number; distKm: number }>
      >;
      const aliados = await loadActiveAliados(admin);
      return mergeAliadosIntoPois({
        tomtomPois: tomtom,
        aliados,
        samplePoints: polyline,
      });
    }
  }

  const samples = sampleAlongPolyline(polyline, POI_SAMPLE_SPACING_KM, POI_MAX_SAMPLES);
  type PoiRow = { name: string; lat: number; lng: number; distKm: number };
  const byKind: Record<TomtomPoiKind, PoiRow[]> = {
    gas_station: [],
    ev_charging: [],
    hospital: [],
    pharmacy: [],
    toll: [],
  };

  let req = 0;
  for (const kind of Object.keys(TOMTOM_POI_CATEGORIES) as TomtomPoiKind[]) {
    for (const pt of samples) {
      if (req > 0) await sleep(TOMTOM_POI_REQUEST_GAP_MS);
      req += 1;
      const categoryId = TOMTOM_POI_CATEGORIES[kind];
      const path =
        `/search/2/nearbySearch/.json?lat=${pt.lat}&lon=${pt.lng}` +
        `&radius=${TOMTOM_POI_MAX_RADIUS_M}&categorySet=${categoryId}&limit=5&language=es-ES`;
      const { ok, data } = await tomtomPoiGet(path);
      if (!ok || !data) continue;
      for (const p of parseNearbySearch(data)) {
        if (
          !poiMatchesExpectedCategory(kind, {
            name: p.name,
            categoryIds: p.categoryIds,
            categories: p.categories,
          })
        ) {
          continue;
        }
        byKind[kind].push({
          name: p.name,
          lat: p.lat || pt.lat,
          lng: p.lng || pt.lng,
          distKm: p.distKm,
        });
      }
    }
  }

  const out: Record<string, PoiRow[]> = {};
  for (const kind of Object.keys(TOMTOM_POI_CATEGORIES) as TomtomPoiKind[]) {
    const picked = dedupePoisByNamePos(byKind[kind], 5, kind);
    out[kind] = kind === "toll" && isKnownMex15dTrip(origin, destination)
      ? mergeCuratedTolls(picked) as PoiRow[]
      : kind === "toll"
      ? picked.filter((p) => /caseta|plaza\s*de\s*cobro/i.test(p.name))
      : picked;
  }

  await cacheSet(admin, cacheKey, "poi", out, TRIP_POI_CACHE_TTL_SEC);

  const aliados = await loadActiveAliados(admin);
  return mergeAliadosIntoPois({
    tomtomPois: out,
    aliados,
    samplePoints: polyline,
  });
}

async function fetchPulsesNearRoute(
  admin: ReturnType<typeof createClient>,
  polyline: LatLng[],
  window: "6h" | "24h",
): Promise<
  Array<{
    id: string;
    kind: "community";
    category: string;
    title: string;
    placeLabel: string;
    createdAt: string;
    status?: string;
    lat: number | null;
    lng: number | null;
    onCorridor: boolean;
    inDestination: boolean;
  }>
> {
  if (polyline.length === 0) return [];
  const lats = polyline.map((p) => p.lat);
  const lngs = polyline.map((p) => p.lng);
  const pad = 0.05; // ~5 km
  const minLat = Math.min(...lats) - pad;
  const maxLat = Math.max(...lats) + pad;
  const minLng = Math.min(...lngs) - pad;
  const maxLng = Math.max(...lngs) + pad;
  const since = new Date(
    Date.now() - (window === "6h" ? 6 : 24) * 3600 * 1000,
  ).toISOString();

  const { data, error } = await admin
    .from("community_posts")
    .select("id,text,place_label,category_guess,lat,lng,created_at,status,source")
    .gte("lat", minLat)
    .lte("lat", maxLat)
    .gte("lng", minLng)
    .lte("lng", maxLng)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(80);

  if (error || !data) {
    if (error) console.warn("pulses load", error.message);
    return [];
  }

  const out: Array<{
    id: string;
    kind: "community";
    category: string;
    title: string;
    placeLabel: string;
    createdAt: string;
    status?: string;
    lat: number | null;
    lng: number | null;
    onCorridor: boolean;
    inDestination: boolean;
  }> = [];

  for (const row of data) {
    const lat = Number(row.lat);
    const lng = Number(row.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const km = minKmToPolyline(lat, lng, polyline);
    if (km > PULSE_ROUTE_BUFFER_KM) continue;
    out.push({
      id: String(row.id),
      kind: "community",
      category: String(row.category_guess || "otro"),
      title: String(row.text || "").slice(0, 120),
      placeLabel: String(row.place_label || "En el camino"),
      createdAt: String(row.created_at),
      status: row.status === "resolved" ? "resolved" : "active",
      lat,
      lng,
      onCorridor: true,
      inDestination: false,
    });
    if (out.length >= 40) break;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let body: {
    direction?: string;
    origin?: LatLng & { name?: string };
    destination?: LatLng & { name?: string };
    fromLabel?: string;
    window?: "6h" | "24h";
    smoke?: boolean;
  } = {};
  try {
    if (req.method !== "GET") body = await req.json();
  } catch {
    body = {};
  }

  const direction =
    body.direction === "mazatlan_to_culiacan"
      ? "mazatlan_to_culiacan"
      : "culiacan_to_mazatlan";
  const window = body.window === "24h" ? "24h" : "6h";

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "missing_supabase_env" }, 500);
  }
  const admin = createClient(supabaseUrl, serviceKey);

  const authHeader = req.headers.get("authorization");
  const fromServiceRole = Boolean(authHeader) && authHeader === `Bearer ${serviceKey}`;
  const smoke = body.smoke === true && fromServiceRole;

  if (!fromServiceRole) {
    const ip = clientIpFromHeaders(req.headers);
    const ipHit = await consumeRateLimit(admin, "ip", ip, TOMTOM_TRAVEL_RATE.maxPerIp);
    if (!ipHit.ok) {
      return json(
        {
          error: "rate_limited",
          scope: "ip",
          retryAfterSeconds: TOMTOM_TRAVEL_RATE.windowSeconds,
          attribution: TOMTOM_ATTRIBUTION,
        },
        429,
      );
    }

    if (authHeader && anonKey) {
      try {
        const userClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const {
          data: { user },
        } = await userClient.auth.getUser();
        if (user?.id) {
          const userHit = await consumeRateLimit(
            admin,
            "user",
            user.id,
            TOMTOM_TRAVEL_RATE.maxPerUser,
          );
          if (!userHit.ok) {
            return json(
              {
                error: "rate_limited",
                scope: "user",
                retryAfterSeconds: TOMTOM_TRAVEL_RATE.windowSeconds,
                attribution: TOMTOM_ATTRIBUTION,
              },
              429,
            );
          }
        }
      } catch {
        // solo tope por IP
      }
    }
  }

  const mexicoWide = Boolean(body.origin && body.destination);
  const endpoints = resolveTravelEndpoints({
    direction,
    origin: body.origin,
    destination: body.destination,
    mexicoWide,
  });

  if (endpoints.error === "outside_mexico") {
    return json(
      {
        error: "outside_mexico",
        message: "Por ahora solo armamos viajes dentro de México.",
        attribution: TOMTOM_ATTRIBUTION,
      },
      400,
    );
  }
  if (endpoints.error === "too_far") {
    return json(
      {
        error: "too_far",
        message: "Ese tramo es muy largo para Modo viaje (máx. ~1,500 km).",
        distanceKm: endpoints.distanceKm,
        attribution: TOMTOM_ATTRIBUTION,
      },
      400,
    );
  }
  if (endpoints.error === "too_short") {
    return json(
      {
        error: "too_short",
        message: "Elige un destino un poco más lejos para ver el camino.",
        attribution: TOMTOM_ATTRIBUTION,
      },
      400,
    );
  }

  const { origin, destination } = endpoints;
  const originName = body.origin?.name || body.fromLabel ||
    (direction === "mazatlan_to_culiacan" ? "Mazatlán" : "Culiacán");
  const destinationName = body.destination?.name ||
    (direction === "mazatlan_to_culiacan" ? "Culiacán" : "Mazatlán");

  if (!tomtomKey()) {
    return json({
      ...mockInsights({
        origin,
        destination,
        originName,
        destinationName,
      }),
      smokeSkipped: body.smoke === true && !fromServiceRole
        ? "smoke_requires_service_role"
        : smoke
        ? "missing_TOMTOM_API_KEY"
        : undefined,
    });
  }

  const route = await fetchRoute(admin, origin, destination, smoke);
  if (!route) {
    return json(
      {
        error: "route_failed",
        message: "No pudimos armar esa ruta ahora. Prueba de nuevo en un momento.",
        attribution: TOMTOM_ATTRIBUTION,
      },
      502,
    );
  }
  if ((route.lengthKm ?? 0) > 1500) {
    return json(
      {
        error: "too_far",
        message: "Ese tramo es muy largo para Modo viaje (máx. ~1,500 km).",
        attribution: TOMTOM_ATTRIBUTION,
      },
      400,
    );
  }

  const polyline = route.points?.length >= 2
    ? route.points
    : [origin, destination];

  const [delays, pois, pulses] = await Promise.all([
    fetchFlowAlongRoute(admin, origin, destination, polyline, smoke),
    fetchPoisAlongRoute(admin, origin, destination, polyline, smoke),
    fetchPulsesNearRoute(admin, polyline, window),
  ]);

  return json({
    mock: false,
    smoke: smoke || undefined,
    attribution: TOMTOM_ATTRIBUTION,
    budget: TOMTOM_BUDGET,
    delays,
    route,
    pois,
    pulses,
    originName,
    destinationName,
    fromLabel: body.fromLabel || null,
    originClamped: endpoints.originClamped || undefined,
    destinationClamped: endpoints.destinationClamped || undefined,
    cityIds: CITY_IDS,
    knownCorridor: isKnownMex15dTrip(origin, destination) ? "mex15d" : null,
  });
});
