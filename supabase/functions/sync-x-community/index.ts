// Sincroniza posts recientes de X (Twitter) sobre seguridad en Culiacán
// hacia la tabla public.community_posts.
//
// Setup:
//   supabase secrets set X_BEARER_TOKEN=AAAA...
//   # opcional: X_ALLOWLIST=LineaDirectaMX:medio,SSPSinaloa:oficial
//   supabase functions deploy sync-x-community
//
// Geo policy: coords del tweet, place.bbox, o geocode de colonia en texto.
// Sin geo usable → lat/lng null (Feed sí, mapa no). Sin jitter.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { geocodeCuliacanText } from "../_shared/culiacanPlaces.ts";
import {
  mergeAllowlist,
  trustForHandle,
  type TrustTier,
} from "../_shared/xAllowlist.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

const PLACE_FALLBACK = "Culiacán (X)";

const PLACE_TERMS = "(Culiacán OR Culiacan OR #Culiacán)";

// Mantener ≤512 chars (límite Recent Search). Soft-noise filtra el resto en código.
const EVENT_TERMS =
  '(alerta OR alertan OR reportan OR "acaba de" OR balacera OR tiroteo OR disparos OR detonaciones OR enfrentamiento OR narcobloqueo OR bloqueo OR accidente OR choque OR asalto OR "zona de riesgo" OR "grupo armado")';

const NOISE_EXCLUSIONS =
  '-is:retweet -is:reply -promo -turismo -partido -gol -"estoy en" -comida';

const X_QUERY_GEO = `${PLACE_TERMS} ${EVENT_TERMS} has:geo ${NOISE_EXCLUSIONS} lang:es`;
const X_QUERY_FEED = `${PLACE_TERMS} ${EVENT_TERMS} ${NOISE_EXCLUSIONS} lang:es`;

if (X_QUERY_GEO.length > 512 || X_QUERY_FEED.length > 512) {
  console.warn(
    "X Recent Search query exceeds 512 chars",
    X_QUERY_GEO.length,
    X_QUERY_FEED.length,
  );
}

const CATEGORY_KEYWORDS: Array<{ guess: string; pattern: RegExp }> = [
  { guess: "balacera", pattern: /\bbalacera\b|\btiroteo\b|\bdisparos?\b/i },
  { guess: "narcobloqueo", pattern: /\bnarcobloqueo\b/i },
  { guess: "enfrentamiento", pattern: /\benfrentamiento\b|\bgrupo armado\b|\belementos armados\b/i },
  { guess: "detonaciones", pattern: /\bdetonaciones?\b/i },
  { guess: "bloqueo", pattern: /\bbloqueo\b|\bbloqueos\b|\btoma de\b/i },
  { guess: "robo", pattern: /\brobo\b|\basalto\b/i },
  { guess: "accidente", pattern: /\baccidente\b|\bchoque\b|\bvolcadura\b/i },
  { guess: "alerta", pattern: /\balerta\b|\balertan\b|\breportan\b|\bzona de riesgo\b/i },
];

const SOFT_NOISE = [
  /\bestoy en\b/i,
  /\bpaseando\b/i,
  /\bvisitando\b/i,
  /\bturismo\b/i,
  /\bvacaciones\b/i,
  /\bairbnb\b/i,
  /\bpartido\b.*\b(gol|estadio|liga)\b/i,
  /\b(descuento|promo(?:ción)?|oferta)\b/i,
  /\bqué rico\b/i,
  /\bbuen clima\b/i,
];

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

function guessCategory(text: string): string | null {
  for (const entry of CATEGORY_KEYWORDS) {
    if (entry.pattern.test(text)) return entry.guess;
  }
  return null;
}

function isSoftNoise(text: string): boolean {
  return SOFT_NOISE.some((re) => re.test(text));
}

type XTweet = {
  id: string;
  text: string;
  created_at?: string;
  author_id?: string;
  geo?: { place_id?: string; coordinates?: { type: string; coordinates: number[] } };
  attachments?: { media_keys?: string[] };
};

type XUser = { id: string; name?: string; username?: string; profile_image_url?: string };
type XPlace = { id: string; full_name?: string; geo?: { bbox?: number[] } };
type XMedia = { media_key: string; url?: string; preview_image_url?: string; type?: string };

type CommunityRow = {
  source: "x";
  external_id: string;
  author_handle: string;
  author_name: string | null;
  text: string;
  url: string;
  media_url: string | null;
  author_avatar_url: string | null;
  lat: number | null;
  lng: number | null;
  place_label: string;
  created_at: string;
  fetched_at: string;
  category_guess: string | null;
  is_demo: boolean;
  trust_tier: TrustTier;
};

async function searchRecent(
  bearer: string,
  query: string,
  maxResults: number,
): Promise<{ tweets: XTweet[]; users: XUser[]; places: XPlace[]; media: XMedia[] }> {
  const params = new URLSearchParams({
    query,
    max_results: String(Math.min(100, Math.max(10, maxResults))),
    "tweet.fields": "created_at,geo,author_id,attachments",
    expansions: "author_id,attachments.media_keys,geo.place_id",
    "user.fields": "name,username,profile_image_url",
    "place.fields": "full_name,geo",
    "media.fields": "url,preview_image_url,type",
  });

  const xRes = await fetch(`https://api.twitter.com/2/tweets/search/recent?${params}`, {
    headers: { Authorization: `Bearer ${bearer}` },
  });

  if (!xRes.ok) {
    const body = await xRes.text();
    const err = new Error(`X API ${xRes.status}: ${body.slice(0, 500)}`);
    (err as Error & { status: number; detail: string }).status = xRes.status;
    (err as Error & { status: number; detail: string }).detail = body.slice(0, 500);
    throw err;
  }

  const payload = await xRes.json();
  return {
    tweets: payload.data ?? [],
    users: payload.includes?.users ?? [],
    places: payload.includes?.places ?? [],
    media: payload.includes?.media ?? [],
  };
}

function resolveGeo(
  tweet: XTweet,
  placeById: Map<string, XPlace>,
): { lat: number | null; lng: number | null; placeLabel: string } {
  const placeId = tweet.geo?.place_id;
  const place = placeId ? placeById.get(placeId) : undefined;
  const placeLabel = place?.full_name ?? PLACE_FALLBACK;

  const coords = tweet.geo?.coordinates?.coordinates;
  if (coords && coords.length >= 2) {
    return { lng: coords[0], lat: coords[1], placeLabel };
  }

  if (place?.geo?.bbox && place.geo.bbox.length >= 4) {
    const [minLng, minLat, maxLng, maxLat] = place.geo.bbox;
    return {
      lng: (minLng + maxLng) / 2,
      lat: (minLat + maxLat) / 2,
      placeLabel,
    };
  }

  const fromText = geocodeCuliacanText(tweet.text);
  if (fromText) {
    return {
      lat: fromText.lat,
      lng: fromText.lng,
      placeLabel: place?.full_name ?? fromText.placeLabel,
    };
  }

  return {
    lat: null,
    lng: null,
    placeLabel: place?.full_name ?? PLACE_FALLBACK,
  };
}

function tweetToRow(
  tweet: XTweet,
  userById: Map<string, XUser>,
  placeById: Map<string, XPlace>,
  mediaByKey: Map<string, XMedia>,
  allowlist: ReturnType<typeof mergeAllowlist>,
): CommunityRow | null {
  if (isSoftNoise(tweet.text)) return null;

  const author = tweet.author_id ? userById.get(tweet.author_id) : undefined;
  const username = author?.username;
  const trust = trustForHandle(username, allowlist);
  const onAllowlist = trust === "medio" || trust === "oficial";
  const category = guessCategory(tweet.text);

  // Allowlist OR señal de evento; menciones blandas sin categoría quedan fuera.
  if (!onAllowlist && !category) return null;

  const handle = username ? `@${username}` : "@desconocido";
  const { lat, lng, placeLabel } = resolveGeo(tweet, placeById);

  let mediaUrl: string | null = null;
  for (const key of tweet.attachments?.media_keys ?? []) {
    const m = mediaByKey.get(key);
    if (m?.url || m?.preview_image_url) {
      mediaUrl = m.url ?? m.preview_image_url ?? null;
      break;
    }
  }

  return {
    source: "x",
    external_id: tweet.id,
    author_handle: handle,
    author_name: author?.name ?? null,
    text: tweet.text,
    url: `https://x.com/${username ?? "i"}/status/${tweet.id}`,
    media_url: mediaUrl,
    // X suele devolver _normal; preferir versión más grande para pines.
    author_avatar_url: author?.profile_image_url
      ? author.profile_image_url.replace("_normal.", "_bigger.")
      : null,
    lat,
    lng,
    place_label: placeLabel,
    created_at: tweet.created_at ?? new Date().toISOString(),
    fetched_at: new Date().toISOString(),
    category_guess: category,
    is_demo: false,
    trust_tier: onAllowlist ? trust : "community",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const bearer = Deno.env.get("X_BEARER_TOKEN");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const allowlist = mergeAllowlist(Deno.env.get("X_ALLOWLIST"));

  if (!supabaseUrl || !serviceKey) {
    return json({ ok: false, error: "Missing Supabase env" }, 500);
  }

  if (!bearer) {
    return json({
      ok: true,
      mode: "demo",
      upserted: 0,
      message:
        "X_BEARER_TOKEN no configurado. Usa seeds DEMO de la migración. Configura el secret y vuelve a invocar.",
    });
  }

  if (!req.headers.get("authorization")) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const admin = createClient(supabaseUrl, serviceKey);

  let batches: Array<Awaited<ReturnType<typeof searchRecent>>> = [];

  try {
    // Pasadas de evento (geo + feed) primero; allowlist en segundo lote para no saturar rate limits.
    const eventBatches = await Promise.all([
      searchRecent(bearer, X_QUERY_GEO, 15),
      searchRecent(bearer, X_QUERY_FEED, 15),
    ]);
    const allowlistQueries = allowlist.slice(0, 5).map((a) => {
      return `(from:${a.handle}) ${PLACE_TERMS} ${NOISE_EXCLUSIONS}`;
    });
    const allowBatches =
      allowlistQueries.length > 0
        ? await Promise.all(allowlistQueries.map((q) => searchRecent(bearer, q, 10)))
        : [];
    batches = [...eventBatches, ...allowBatches];
  } catch (e) {
    const err = e as Error & { status?: number; detail?: string };
    if (err.message?.startsWith("X API ")) {
      console.error("X API error", err.status, err.detail);
      return json(
        { ok: false, error: "X API error", status: err.status, detail: err.detail },
        502,
      );
    }
    console.error("X API fetch failed", e);
    return json({ ok: false, error: "X API network error" }, 502);
  }

  const tweetById = new Map<string, XTweet>();
  const users: XUser[] = [];
  const places: XPlace[] = [];
  const media: XMedia[] = [];

  for (const batch of batches) {
    for (const t of batch.tweets) {
      if (!tweetById.has(t.id)) tweetById.set(t.id, t);
    }
    users.push(...batch.users);
    places.push(...batch.places);
    media.push(...batch.media);
  }

  const tweets = Array.from(tweetById.values()).sort((a, b) => {
    const ta = a.created_at ? Date.parse(a.created_at) : 0;
    const tb = b.created_at ? Date.parse(b.created_at) : 0;
    return tb - ta;
  });

  const userById = new Map(users.map((u) => [u.id, u]));
  const placeById = new Map(places.map((p) => [p.id, p]));
  const mediaByKey = new Map(media.map((m) => [m.media_key, m]));

  if (tweets.length === 0) {
    return json({ ok: true, mode: "live", upserted: 0, message: "Sin resultados recientes" });
  }

  const rows: CommunityRow[] = [];
  let withGeo = 0;
  let feedOnly = 0;
  for (const tweet of tweets) {
    const row = tweetToRow(tweet, userById, placeById, mediaByKey, allowlist);
    if (!row) continue;
    if (row.lat != null && row.lng != null) withGeo += 1;
    else feedOnly += 1;
    rows.push(row);
  }

  if (rows.length === 0) {
    return json({
      ok: true,
      mode: "live",
      upserted: 0,
      with_geo: 0,
      feed_only: 0,
      message: "Sin posts de alerta/evento tras filtros",
    });
  }

  const { error, data } = await admin
    .from("community_posts")
    .upsert(rows, { onConflict: "source,external_id" })
    .select("id");

  if (error) {
    console.error("upsert community_posts failed", error);
    return json({ ok: false, error: error.message }, 500);
  }

  return json({
    ok: true,
    mode: "live",
    upserted: data?.length ?? rows.length,
    with_geo: withGeo,
    feed_only: feedOnly,
    allowlist_size: allowlist.length,
  });
});
