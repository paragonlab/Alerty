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
  TOMTOM_TRAVEL_RATE,
  clientIpFromHeaders,
  extraMinutesFromFlow,
  parseCalculateRoute,
  parseNearbySearch,
  rateLimitBucket,
  rateLimitCacheKey,
  tomtomGetJson,
  tomtomKey,
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
        { name: "Gasolinera demo · Costa Rica", lat: 24.55, lng: -107.44, distKm: 0.4 },
      ],
      hospital: [
        { name: "Hospital demo · Villa Unión", lat: 23.3, lng: -106.36, distKm: 1.2 },
      ],
      pharmacy: [
        { name: "Farmacia demo · Dimas", lat: 23.72, lng: -106.78, distKm: 0.8 },
      ],
      toll: [
        { name: "Caseta demo · 15D", lat: 24.4, lng: -107.4, distKm: 0.2 },
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

const POI_CATEGORIES: Record<string, string> = {
  gas_station: "7309",
  hospital: "7321",
  pharmacy: "7326",
  // Toll booth / plaza — category varies; use 7376 (Open Parking) fallback + query
  toll: "7372",
};

async function fetchPois(
  admin: ReturnType<typeof createClient>,
  skipCache = false,
): Promise<Record<string, Array<{ name: string; lat: number; lng: number; distKm: number }>>> {
  const cacheKey = "poi:corridor:v1";
  if (!skipCache) {
    const cached = await cacheGet(admin, cacheKey);
    if (cached && typeof cached === "object") {
      return cached as Record<
        string,
        Array<{ name: string; lat: number; lng: number; distKm: number }>
      >;
    }
  }

  const mid = CORRIDOR_FLOW_POINTS[2]; // Elota-ish midpoint
  const out: Record<
    string,
    Array<{ name: string; lat: number; lng: number; distKm: number }>
  > = {
    gas_station: [],
    hospital: [],
    pharmacy: [],
    toll: [],
  };

  for (const [kind, cat] of Object.entries(POI_CATEGORIES)) {
    const path =
      `/search/2/nearbySearch/.json?lat=${mid.lat}&lon=${mid.lng}` +
      `&radius=80000&categorySet=${cat}&limit=5&language=es-ES`;
    const { ok, data } = await tomtomGetJson(path);
    if (!ok || !data) continue;
    out[kind] = parseNearbySearch(data).map((p) => ({
      ...p,
      lat: p.lat || mid.lat,
      lng: p.lng || mid.lng,
    }));
  }

  await cacheSet(admin, cacheKey, "poi", out, 6 * 3600);
  return out;
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
  const smoke = body.smoke === true;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "missing_supabase_env" }, 500);
  }
  const admin = createClient(supabaseUrl, serviceKey);

  const authHeader = req.headers.get("authorization");
  const fromServiceRole = Boolean(authHeader) && authHeader === `Bearer ${serviceKey}`;

  // Rate limit por IP (+ usuario si hay sesión). Service role (smoke) no cuenta.
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
      smokeSkipped: smoke ? "missing_TOMTOM_API_KEY" : undefined,
    });
  }

  const origin =
    body.origin && Number.isFinite(body.origin.lat)
      ? body.origin
      : direction === "mazatlan_to_culiacan"
        ? MZT
        : CUL;
  const destination =
    body.destination && Number.isFinite(body.destination.lat)
      ? body.destination
      : direction === "mazatlan_to_culiacan"
        ? CUL
        : MZT;

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
    cityIds: CITY_IDS,
  });
});
