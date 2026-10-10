/**
 * Insights de Modo viaje: Flow (retraso por tramo), Routing con tráfico, POI.
 * Cache en tomtom_cache. Mock si falta TOMTOM_API_KEY (demos/screenshots).
 * Rate limit por IP (y por user si hay JWT de sesión) para no abusar de la cuota.
 *
 * POST body: { direction?: "culiacan_to_mazatlan"|"mazatlan_to_culiacan",
 *              origin?: {lat,lng}, destination?: {lat,lng}, fromLabel?: string,
 *              smoke?: boolean }  // smoke=true: sin cache, para scripts/tomtom-smoke.mjs --edge
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { CITY_IDS } from "../_shared/cities.ts";
import {
  CORRIDOR_FLOW_POINTS,
  TOMTOM_ATTRIBUTION,
  TOMTOM_BUDGET,
  TOMTOM_POI_CACHE_KEY,
  TOMTOM_POI_CATEGORIES,
  TOMTOM_POI_MAX_RADIUS_M,
  TOMTOM_POI_REQUEST_GAP_MS,
  TOMTOM_POI_RETRY_BACKOFF_MS,
  TOMTOM_POI_SAMPLE_POINTS,
  TOMTOM_TRAVEL_RATE,
  buildPoiFetchPlan,
  clientIpFromHeaders,
  extraMinutesFromFlow,
  mergeAliadosIntoPois,
  parseCalculateRoute,
  parseNearbySearch,
  pickPoisRoundRobinBySample,
  poiCacheTtlSeconds,
  poiListsAreEmpty,
  poiMatchesExpectedCategory,
  rateLimitBucket,
  rateLimitCacheKey,
  resolveTravelEndpoints,
  tomtomGetJson,
  tomtomKey,
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

/** Incrementa contador en tomtom_cache; false si ya superó el tope. */
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

function mockInsights(direction: string) {
  const origin = direction === "mazatlan_to_culiacan" ? MZT : CUL;
  const destination = direction === "mazatlan_to_culiacan" ? CUL : MZT;
  return {
    mock: true,
    attribution: TOMTOM_ATTRIBUTION,
    budget: TOMTOM_BUDGET,
    delays: [
      { id: "elota", label: "cerca de Elota", extraMinutes: 12 },
      { id: "dimas", label: "cerca de Dimas", extraMinutes: 5 },
    ],
    route: {
      source: "mock",
      summary: "México 15D · con tráfico (demo)",
      travelTimeMinutes: 168,
      trafficDelayMinutes: 18,
      lengthKm: 218,
      alternates: [
        { summary: "México 15 libre", travelTimeMinutes: 195, trafficDelayMinutes: 10 },
      ],
      origin,
      destination,
    },
    pois: {
      gas_station: [
        {
          name: "Gasolinera demo · Costa Rica",
          lat: 24.55,
          lng: -107.44,
          distKm: 0.4,
          source: "tomtom",
        },
      ],
      ev_charging: [
        {
          name: "Cargador demo · Elota",
          lat: 23.95,
          lng: -107.02,
          distKm: 0.5,
          source: "tomtom",
        },
      ],
      hospital: [
        {
          name: "Hospital demo · Villa Unión",
          lat: 23.3,
          lng: -106.36,
          distKm: 1.2,
          source: "tomtom",
        },
      ],
      pharmacy: [
        {
          name: "Farmacia Aliada · Dimas",
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
      toll: [
        {
          name: "Caseta demo · 15D",
          lat: 24.4,
          lng: -107.4,
          distKm: 0.2,
          source: "tomtom",
        },
      ],
    },
  };
}

async function fetchFlowDelays(
  admin: ReturnType<typeof createClient>,
  skipCache = false,
): Promise<Array<{ id: string; label: string; extraMinutes: number }>> {
  const cacheKey = "flow:corridor:v1";
  if (!skipCache) {
    const cached = await cacheGet(admin, cacheKey);
    if (cached && Array.isArray((cached as { delays?: unknown }).delays)) {
      return (cached as { delays: Array<{ id: string; label: string; extraMinutes: number }> })
        .delays;
    }
  }

  const delays: Array<{ id: string; label: string; extraMinutes: number }> = [];
  for (const p of CORRIDOR_FLOW_POINTS) {
    const path =
      `/traffic/services/4/flowSegmentData/relative/10/json?point=${p.lat},${p.lng}&unit=KMPH`;
    const { ok, data } = await tomtomGetJson(path);
    if (!ok || !data) continue;
    const extra = extraMinutesFromFlow(data);
    if (extra >= 3) {
      delays.push({ id: p.id, label: p.label, extraMinutes: extra });
    }
  }

  await cacheSet(admin, cacheKey, "flow", { delays }, 30 * 60);
  return delays;
}

async function fetchRoute(
  admin: ReturnType<typeof createClient>,
  origin: LatLng,
  destination: LatLng,
  skipCache = false,
): Promise<unknown> {
  const key =
    `route:${origin.lat.toFixed(3)},${origin.lng.toFixed(3)}:` +
    `${destination.lat.toFixed(3)},${destination.lng.toFixed(3)}`;
  if (!skipCache) {
    const cached = await cacheGet(admin, key);
    if (cached) return cached;
  }

  const path =
    `/routing/1/calculateRoute/${origin.lat},${origin.lng}:${destination.lat},${destination.lng}/json` +
    `?traffic=true&travelMode=car&routeType=fastest&maxAlternatives=1&language=es-ES`;
  const { ok, data } = await tomtomGetJson(path);
  if (!ok || !data) return null;

  const parsed = parseCalculateRoute(data);
  if (!parsed) return null;
  const payload = {
    source: "tomtom",
    ...parsed,
    origin,
    destination,
  };
  await cacheSet(admin, key, "route", payload, 45 * 60);
  return payload;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** NearbySearch con 1 reintento en 429 (backoff) y log de no-200. */
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

async function fetchTomtomPoisCached(
  admin: ReturnType<typeof createClient>,
  skipCache = false,
): Promise<Record<string, Array<{ name: string; lat: number; lng: number; distKm: number }>>> {
  const cacheKey = TOMTOM_POI_CACHE_KEY;
  if (!skipCache) {
    const cached = await cacheGet(admin, cacheKey);
    if (cached && typeof cached === "object") {
      return cached as Record<
        string,
        Array<{ name: string; lat: number; lng: number; distKm: number }>
      >;
    }
  }

  type PoiRow = { name: string; lat: number; lng: number; distKm: number };
  const emptyBuckets = (): PoiRow[][] => TOMTOM_POI_SAMPLE_POINTS.map(() => []);
  const byKindSample: Record<TomtomPoiKind, PoiRow[][]> = {
    gas_station: emptyBuckets(),
    ev_charging: emptyBuckets(),
    hospital: emptyBuckets(),
    pharmacy: emptyBuckets(),
    toll: emptyBuckets(),
  };

  let anyFailed = false;
  const plan = buildPoiFetchPlan();
  for (let i = 0; i < plan.length; i++) {
    if (i > 0) await sleep(TOMTOM_POI_REQUEST_GAP_MS);
    const step = plan[i]!;
    const pt = TOMTOM_POI_SAMPLE_POINTS[step.pointIndex]!;
    const path =
      `/search/2/nearbySearch/.json?lat=${pt.lat}&lon=${pt.lng}` +
      `&radius=${TOMTOM_POI_MAX_RADIUS_M}&categorySet=${step.categoryId}&limit=5&language=es-ES`;
    const { ok, data } = await tomtomPoiGet(path);
    if (!ok || !data) {
      anyFailed = true;
      continue;
    }
    for (const p of parseNearbySearch(data)) {
      if (
        !poiMatchesExpectedCategory(step.kind, {
          name: p.name,
          categoryIds: p.categoryIds,
          categories: p.categories,
        })
      ) {
        continue;
      }
      byKindSample[step.kind][step.pointIndex]!.push({
        name: p.name,
        lat: p.lat || pt.lat,
        lng: p.lng || pt.lng,
        distKm: p.distKm,
      });
    }
  }

  const out: Record<string, PoiRow[]> = {};
  for (const kind of Object.keys(TOMTOM_POI_CATEGORIES) as TomtomPoiKind[]) {
    out[kind] = pickPoisRoundRobinBySample(byKindSample[kind], 5);
  }

  const empty = poiListsAreEmpty(out);
  await cacheSet(
    admin,
    cacheKey,
    "poi",
    out,
    poiCacheTtlSeconds({ empty, anyFailed }),
  );
  return out;
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

async function fetchPois(
  admin: ReturnType<typeof createClient>,
  skipCache = false,
): Promise<Record<string, TravelPoi[]>> {
  const tomtom = await fetchTomtomPoisCached(admin, skipCache);
  const aliados = await loadActiveAliados(admin);
  return mergeAliadosIntoPois({ tomtomPois: tomtom, aliados });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let body: {
    direction?: string;
    origin?: LatLng;
    destination?: LatLng;
    fromLabel?: string;
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "missing_supabase_env" }, 500);
  }
  const admin = createClient(supabaseUrl, serviceKey);

  const authHeader = req.headers.get("authorization");
  const fromServiceRole = Boolean(authHeader) && authHeader === `Bearer ${serviceKey}`;
  // smoke:true solo con service role (evita saltar cache / quemar cuota desde el cliente).
  const smoke = body.smoke === true && fromServiceRole;

  // Rate limit por IP (+ usuario si hay sesión). Service role no cuenta.
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
        // JWT anon / inválido: solo cuenta el tope por IP.
      }
    }
  }

  if (!tomtomKey()) {
    return json({
      ...mockInsights(direction),
      smokeSkipped: body.smoke === true && !fromServiceRole
        ? "smoke_requires_service_role"
        : smoke
          ? "missing_TOMTOM_API_KEY"
          : undefined,
    });
  }

  const endpoints = resolveTravelEndpoints({
    direction,
    origin: body.origin,
    destination: body.destination,
  });
  const { origin, destination } = endpoints;

  const [delays, route, pois] = await Promise.all([
    fetchFlowDelays(admin, smoke),
    fetchRoute(admin, origin, destination, smoke),
    fetchPois(admin, smoke),
  ]);

  return json({
    mock: false,
    smoke: smoke || undefined,
    attribution: TOMTOM_ATTRIBUTION,
    budget: TOMTOM_BUDGET,
    delays,
    route: route || {
      source: "static",
      summary: "Corredor México 15 / 15D",
      travelTimeMinutes: null,
      trafficDelayMinutes: null,
      lengthKm: 220,
      alternates: [],
      origin,
      destination,
    },
    pois,
    fromLabel: body.fromLabel || null,
    originClamped: endpoints.originClamped || undefined,
    destinationClamped: endpoints.destinationClamped || undefined,
    cityIds: CITY_IDS,
  });
});
