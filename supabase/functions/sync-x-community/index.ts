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
import { resolveCommunityGeo } from "../_shared/culiacanPlaces.ts";
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
  { guess: "incendio", pattern: /\bincendio\b|\bse quema\b|\bconflagraci[oó]n\b|\blamas\b/i },
  { guess: "inundacion", pattern: /\binundaci[oó]n\b|\binundad[oa]s?\b|\bencharcamiento\b|\bdesborde\b/i },
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
type XMedia = {
  media_key: string;
  url?: string;
  preview_image_url?: string;
  type?: string;
  variants?: Array<{ content_type?: string; bit_rate?: number; url?: string }>;
};

type CommunityRow = {
  source: "x";
  external_id: string;
  author_handle: string;
  author_name: string | null;
  text: string;
  url: string;
  media_url: string | null;
  video_url?: string | null;
  author_avatar_url: string | null;
  lat: number | null;
  lng: number | null;
  place_label: string;
  geo_source: string;
  place_name_source: string | null;
  geocoded_from_text: string | null;
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
    "media.fields": "url,preview_image_url,type,variants",
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
): {
  lat: number | null;
  lng: number | null;
  placeLabel: string;
  geoSource: string;
  placeNameSource: string | null;
  geocodedFromText: string | null;
} {
  const placeId = tweet.geo?.place_id;
  const place = placeId ? placeById.get(placeId) : undefined;
  const publisherPlaceLabel = place?.full_name ?? null;

  let coords: { lat: number; lng: number } | null = null;
  const rawCoords = tweet.geo?.coordinates?.coordinates;
  if (rawCoords && rawCoords.length >= 2) {
    coords = { lng: rawCoords[0], lat: rawCoords[1] };
  }

  let placeBboxCenter: { lat: number; lng: number } | null = null;
  if (place?.geo?.bbox && place.geo.bbox.length >= 4) {
    const [minLng, minLat, maxLng, maxLat] = place.geo.bbox;
    placeBboxCenter = {
      lng: (minLng + maxLng) / 2,
      lat: (minLat + maxLat) / 2,
    };
  }

  const resolved = resolveCommunityGeo({
    text: tweet.text,
    coords,
    placeBboxCenter,
    publisherPlaceLabel,
    fallbackLabel: PLACE_FALLBACK,
  });

  return {
    lat: resolved.mapEligible ? resolved.lat : null,
    lng: resolved.mapEligible ? resolved.lng : null,
    placeLabel: resolved.placeLabel,
    geoSource: resolved.geoSource,
    placeNameSource: resolved.placeNameSource,
    geocodedFromText: resolved.geocodedFromText,
  };
}

/**
 * mp4 para reproducirlo a pantalla completa en la app. La calidad más alta que
 * no pase de ~2.2 Mbps: se ve bien en el teléfono sin gastar datos de más.
 */
function pickVideoUrl(tweet: XTweet, mediaByKey: Map<string, XMedia>): string | null {
  for (const key of tweet.attachments?.media_keys ?? []) {
    const mp4 = (mediaByKey.get(key)?.variants ?? [])
      .filter((v) => v.content_type === "video/mp4" && v.url)
      .sort((a, b) => (a.bit_rate ?? 0) - (b.bit_rate ?? 0));
    if (mp4.length === 0) continue;
    const pick = [...mp4].reverse().find((v) => (v.bit_rate ?? 0) <= 2_200_000) ?? mp4[0];
    return pick.url ?? null;
  }
  return null;
}

type LookupPayload = {
  data?: XTweet[];
  includes?: { media?: XMedia[] };
  errors?: Array<{ value?: string; resource_id?: string; type?: string }>;
};

/**
 * Posts de X con video guardados sin el mp4 (antes de guardarlo, o de una
 * pasada que no lo trajo): se completan con el lookup de X. Si X responde que
 * el post ya no existe o es privado, se borra: sus reglas piden quitarlo en
 * menos de 24 h, y esto corre cada 10 minutos.
 */
async function hydrateVideos(
  admin: ReturnType<typeof createClient>,
  bearer: string,
): Promise<{ hydrated: number; removed: number }> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: pending } = await admin
    .from("community_posts")
    .select("id,external_id")
    .eq("source", "x")
    .is("video_url", null)
    .ilike("media_url", "%video_thumb%")
    .gte("created_at", since)
    .limit(100);
  if (!pending?.length) return { hydrated: 0, removed: 0 };

  try {
    const params = new URLSearchParams({
      ids: pending.map((p: { external_id: string }) => p.external_id).join(","),
      expansions: "attachments.media_keys",
      "media.fields": "type,variants",
    });
    const res = await fetch(`https://api.twitter.com/2/tweets?${params}`, {
      headers: { Authorization: `Bearer ${bearer}` },
    });
    if (!res.ok) {
      console.error("X lookup", res.status, (await res.text()).slice(0, 300));
      return { hydrated: 0, removed: 0 };
    }
    const payload = (await res.json()) as LookupPayload;
    const mediaByKey = new Map((payload.includes?.media ?? []).map((m) => [m.media_key, m]));

    let hydrated = 0;
    for (const tweet of payload.data ?? []) {
      const url = pickVideoUrl(tweet, mediaByKey);
      if (!url) continue;
      const { error } = await admin
        .from("community_posts")
        .update({ video_url: url })
        .eq("source", "x")
        .eq("external_id", tweet.id);
      if (!error) hydrated += 1;
    }

    const gone = (payload.errors ?? [])
      .filter((e) => /resource-not-found|not-authorized-for-resource/.test(e.type ?? ""))
      .map((e) => e.resource_id ?? e.value)
      .filter((id): id is string => Boolean(id));
    let removed = 0;
    if (gone.length > 0) {
      const { data: deleted } = await admin
        .from("community_posts")
        .delete()
        .eq("source", "x")
        .in("external_id", gone)
        .select("id");
      removed = deleted?.length ?? 0;
    }
    return { hydrated, removed };
  } catch (e) {
    console.error("X lookup failed", e);
    return { hydrated: 0, removed: 0 };
  }
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
  const { lat, lng, placeLabel, geoSource, placeNameSource, geocodedFromText } = resolveGeo(
    tweet,
    placeById,
  );

  let mediaUrl: string | null = null;
  for (const key of tweet.attachments?.media_keys ?? []) {
    const m = mediaByKey.get(key);
    if (m?.url || m?.preview_image_url) {
      mediaUrl = m.url ?? m.preview_image_url ?? null;
      break;
    }
  }

  const videoUrl = pickVideoUrl(tweet, mediaByKey);

  return {
    source: "x",
    external_id: tweet.id,
    author_handle: handle,
    author_name: author?.name ?? null,
    text: tweet.text,
    url: `https://x.com/${username ?? "i"}/status/${tweet.id}`,
    media_url: mediaUrl,
    video_url: videoUrl,
    // X suele devolver _normal; preferir versión más grande para pines.
    author_avatar_url: author?.profile_image_url
      ? author.profile_image_url.replace("_normal.", "_bigger.")
      : null,
    lat,
    lng,
    place_label: placeLabel,
    geo_source: geoSource,
    place_name_source: placeNameSource,
    geocoded_from_text: geocodedFromText,
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
  const hydration = await hydrateVideos(admin, bearer);

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
    return json({ ok: true, mode: "live", upserted: 0, message: "Sin resultados recientes", ...hydration });
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
      ...hydration,
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
    ...hydration,
  });
});
