/**
 * Autocomplete TomTom Fuzzy Search (proxy).
 * La key de servidor nunca sale al cliente. Cache + rate limit en tomtom_cache.
 *
 * POST { q: string }  — mín. 3 caracteres, sesgado a México.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import {
  TOMTOM_ATTRIBUTION,
  TOMTOM_PLACES_RATE,
  clientIpFromHeaders,
  normalizePlacesQuery,
  parseFuzzySearch,
  placesCacheKey,
  rateLimitBucket,
  rateLimitCacheKey,
  tomtomGetJson,
  tomtomKey,
} from "../_shared/tomtom.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

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
): Promise<boolean> {
  const bucket = rateLimitBucket(Date.now(), TOMTOM_PLACES_RATE.windowSeconds);
  const key = rateLimitCacheKey(kind, id, bucket);
  const cached = await cacheGet(admin, key);
  const count = Number((cached as { count?: number } | null)?.count) || 0;
  if (count >= max) return false;
  await cacheSet(
    admin,
    key,
    "ratelimit",
    { count: count + 1 },
    TOMTOM_PLACES_RATE.windowSeconds,
  );
  return true;
}

const MOCK_PLACES = [
  { name: "Culiacán, Sinaloa", lat: 24.8091, lng: -107.394, municipality: "Culiacán" },
  { name: "Mazatlán, Sinaloa", lat: 23.2494, lng: -106.4111, municipality: "Mazatlán" },
  { name: "Los Mochis, Sinaloa", lat: 25.7903, lng: -108.9859, municipality: "Ahome" },
  { name: "Tepic, Nayarit", lat: 21.5041, lng: -104.8946, municipality: "Tepic" },
  { name: "Guadalajara, Jalisco", lat: 20.6597, lng: -103.3496, municipality: "Guadalajara" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let body: { q?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const q = normalizePlacesQuery(String(body.q || ""));
  if (q.length < 3) {
    return json({ results: [], attribution: TOMTOM_ATTRIBUTION });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "missing_supabase_env" }, 500);
  }
  const admin = createClient(supabaseUrl, serviceKey);

  const authHeader = req.headers.get("authorization");
  const fromServiceRole = Boolean(authHeader) && authHeader === `Bearer ${serviceKey}`;

  if (!fromServiceRole) {
    const ip = clientIpFromHeaders(req.headers);
    if (!(await consumeRateLimit(admin, "ip", ip, TOMTOM_PLACES_RATE.maxPerIp))) {
      return json(
        {
          error: "rate_limited",
          scope: "ip",
          retryAfterSeconds: TOMTOM_PLACES_RATE.windowSeconds,
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
        if (
          user?.id &&
          !(await consumeRateLimit(admin, "user", user.id, TOMTOM_PLACES_RATE.maxPerUser))
        ) {
          return json(
            {
              error: "rate_limited",
              scope: "user",
              retryAfterSeconds: TOMTOM_PLACES_RATE.windowSeconds,
            },
            429,
          );
        }
      } catch {
        // ignore
      }
    }
  }

  const cacheKey = placesCacheKey(q);
  const cached = await cacheGet(admin, cacheKey);
  if (cached && typeof cached === "object" && Array.isArray((cached as { results?: unknown }).results)) {
    return json({
      ...(cached as object),
      cached: true,
      attribution: TOMTOM_ATTRIBUTION,
    });
  }

  if (!tomtomKey()) {
    const ql = q.toLowerCase();
    const results = MOCK_PLACES.filter((p) => p.name.toLowerCase().includes(ql)).slice(0, 6);
    return json({ results, mock: true, attribution: TOMTOM_ATTRIBUTION });
  }

  const path =
    `/search/2/search/${encodeURIComponent(q)}.json` +
    `?typeahead=true&limit=6&countrySet=MX&language=es-MX&idxSet=Geo,PAD,Addr,POI`;
  const { ok, data } = await tomtomGetJson(path);
  if (!ok || !data) {
    return json(
      {
        error: "search_failed",
        results: [],
        attribution: TOMTOM_ATTRIBUTION,
      },
      502,
    );
  }

  const results = parseFuzzySearch(data);
  const payload = { results };
  await cacheSet(admin, cacheKey, "places", payload, 24 * 3600);
  return json({ ...payload, attribution: TOMTOM_ATTRIBUTION });
});
