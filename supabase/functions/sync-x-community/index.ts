// Sincroniza posts recientes de X (Twitter) sobre seguridad en Culiacán
// hacia la tabla public.community_posts.
//
// Setup:
//   supabase secrets set X_BEARER_TOKEN=AAAA...
//   supabase functions deploy sync-x-community
//
// Cron (cada 5–10 min), ejemplo con pg_cron + pg_net o el scheduler de Supabase:
//   select cron.schedule(
//     'sync-x-community',
//     '*/10 * * * *',
//     $$
//     select net.http_post(
//       url := 'https://YOUR_PROJECT.supabase.co/functions/v1/sync-x-community',
//       headers := jsonb_build_object(
//         'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
//         'Content-Type', 'application/json'
//       ),
//       body := '{}'::jsonb
//     );
//     $$
//   );
// O desde un cron externo:
//   curl -X POST "$SUPABASE_URL/functions/v1/sync-x-community" \
//     -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
//
// Sin X_BEARER_TOKEN: responde mode=demo y no llama a la API (los seeds DEMO
// de la migración siguen visibles en la app).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

const CULIACAN_CENTER = { lat: 24.8091, lng: -107.394 };
const PLACE_FALLBACK = "Culiacán (X)";

// Recent search: Culiacán + keywords de seguridad. Excluye retweets.
const X_QUERY =
  '(Culiacán OR Culiacan OR #Culiacán OR #Culiacan) (alerta OR balacera OR accidente OR bloqueo OR detonaciones OR enfrentamiento OR narcobloqueo OR robo OR tiroteo OR "zona de riesgo") -is:retweet lang:es';

const CATEGORY_KEYWORDS: Array<{ guess: string; pattern: RegExp }> = [
  { guess: "balacera", pattern: /\bbalacera\b|\btiroteo\b/i },
  { guess: "narcobloqueo", pattern: /\bnarcobloqueo\b/i },
  { guess: "enfrentamiento", pattern: /\benfrentamiento\b/i },
  { guess: "detonaciones", pattern: /\bdetonaciones?\b|\bdisparos?\b/i },
  { guess: "bloqueo", pattern: /\bbloqueo\b|\bbloqueos\b/i },
  { guess: "robo", pattern: /\brobo\b|\basalto\b/i },
  { guess: "accidente", pattern: /\baccidente\b|\bchoque\b/i },
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

function jitterAroundCenter(seed: string): { lat: number; lng: number } {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const dLat = ((h % 1000) / 1000 - 0.5) * 0.04;
  const dLng = (((h / 1000) % 1000) / 1000 - 0.5) * 0.04;
  return {
    lat: CULIACAN_CENTER.lat + dLat,
    lng: CULIACAN_CENTER.lng + dLng,
  };
}

type XTweet = {
  id: string;
  text: string;
  created_at?: string;
  author_id?: string;
  geo?: { place_id?: string; coordinates?: { type: string; coordinates: number[] } };
  attachments?: { media_keys?: string[] };
};

type XUser = { id: string; name?: string; username?: string };
type XPlace = { id: string; full_name?: string; geo?: { bbox?: number[] } };
type XMedia = { media_key: string; url?: string; preview_image_url?: string; type?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const bearer = Deno.env.get("X_BEARER_TOKEN");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

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

  // Autorización: service role o usuario autenticado (anon key + JWT).
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const admin = createClient(supabaseUrl, serviceKey);

  const params = new URLSearchParams({
    query: X_QUERY,
    max_results: "20",
    "tweet.fields": "created_at,geo,author_id,attachments",
    expansions: "author_id,attachments.media_keys,geo.place_id",
    "user.fields": "name,username",
    "place.fields": "full_name,geo",
    "media.fields": "url,preview_image_url,type",
  });

  let xRes: Response;
  try {
    xRes = await fetch(`https://api.twitter.com/2/tweets/search/recent?${params}`, {
      headers: { Authorization: `Bearer ${bearer}` },
    });
  } catch (e) {
    console.error("X API fetch failed", e);
    return json({ ok: false, error: "X API network error" }, 502);
  }

  if (!xRes.ok) {
    const body = await xRes.text();
    console.error("X API error", xRes.status, body);
    return json(
      {
        ok: false,
        error: "X API error",
        status: xRes.status,
        detail: body.slice(0, 500),
      },
      502,
    );
  }

  const payload = await xRes.json();
  const tweets: XTweet[] = payload.data ?? [];
  const users: XUser[] = payload.includes?.users ?? [];
  const places: XPlace[] = payload.includes?.places ?? [];
  const media: XMedia[] = payload.includes?.media ?? [];

  const userById = new Map(users.map((u) => [u.id, u]));
  const placeById = new Map(places.map((p) => [p.id, p]));
  const mediaByKey = new Map(media.map((m) => [m.media_key, m]));

  if (tweets.length === 0) {
    return json({ ok: true, mode: "live", upserted: 0, message: "Sin resultados recientes" });
  }

  const rows = tweets.map((tweet) => {
    const author = tweet.author_id ? userById.get(tweet.author_id) : undefined;
    const handle = author?.username ? `@${author.username}` : "@desconocido";
    const placeId = tweet.geo?.place_id;
    const place = placeId ? placeById.get(placeId) : undefined;

    let lat: number | null = null;
    let lng: number | null = null;
    let placeLabel: string = PLACE_FALLBACK;

    // Geo exacto del tweet (Point: [lng, lat])
    const coords = tweet.geo?.coordinates?.coordinates;
    if (coords && coords.length >= 2) {
      lng = coords[0];
      lat = coords[1];
      placeLabel = place?.full_name ?? PLACE_FALLBACK;
    } else if (place?.geo?.bbox && place.geo.bbox.length >= 4) {
      // Centro del bbox: [min_lng, min_lat, max_lng, max_lat]
      const [minLng, minLat, maxLng, maxLat] = place.geo.bbox;
      lng = (minLng + maxLng) / 2;
      lat = (minLat + maxLat) / 2;
      placeLabel = place.full_name ?? PLACE_FALLBACK;
    } else {
      const jitter = jitterAroundCenter(tweet.id);
      lat = jitter.lat;
      lng = jitter.lng;
      placeLabel = PLACE_FALLBACK;
    }

    let mediaUrl: string | null = null;
    const keys = tweet.attachments?.media_keys ?? [];
    for (const key of keys) {
      const m = mediaByKey.get(key);
      if (m?.url || m?.preview_image_url) {
        mediaUrl = m.url ?? m.preview_image_url ?? null;
        break;
      }
    }

    const username = author?.username ?? "i";
    return {
      source: "x",
      external_id: tweet.id,
      author_handle: handle,
      author_name: author?.name ?? null,
      text: tweet.text,
      url: `https://x.com/${username}/status/${tweet.id}`,
      media_url: mediaUrl,
      lat,
      lng,
      place_label: placeLabel,
      created_at: tweet.created_at ?? new Date().toISOString(),
      fetched_at: new Date().toISOString(),
      category_guess: guessCategory(tweet.text),
      is_demo: false,
    };
  });

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
  });
});
