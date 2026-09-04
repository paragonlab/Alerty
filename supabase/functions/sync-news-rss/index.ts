// Ingesta RSS de noticias locales (Culiacán / Sinaloa) → community_posts (source=rss).
//
// Deploy:
//   supabase functions deploy sync-news-rss
//
// Opcional:
//   supabase secrets set NEWS_RSS_FEEDS='https://...,https://...'
//
// Cron: igual que sync-x-community (cada 10–30 min).
// Geo: geocode de colonias en título/descripción; si no hay match → Feed-only.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { geocodeCuliacanText } from "../_shared/culiacanPlaces.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

/** Feeds por defecto — editar o sobrescribir con NEWS_RSS_FEEDS (URLs separadas por coma). */
const DEFAULT_FEEDS: Array<{ name: string; handle: string; url: string; logoUrl?: string }> = [
  {
    name: "Línea Directa",
    handle: "@LineaDirectaMX",
    url: "https://lineadirectaportal.com/feed",
    logoUrl: "https://www.google.com/s2/favicons?domain=lineadirectaportal.com&sz=64",
  },
  {
    name: "Ríodoce",
    handle: "@Riodoce",
    url: "https://riodoce.mx/feed",
    logoUrl: "https://www.google.com/s2/favicons?domain=riodoce.mx&sz=64",
  },
  {
    name: "Noroeste",
    handle: "@Noroeste",
    url: "https://www.noroeste.com.mx/rss/portada.xml",
    logoUrl: "https://www.google.com/s2/favicons?domain=noroeste.com.mx&sz=64",
  },
];

const EVENT_HINT =
  /\b(alerta|balacera|tiroteo|accidente|bloqueo|detonaci|enfrentamiento|asalto|robo|narcobloqueo|choque|persecuci|culiac[aá]n|sinaloa)\b/i;

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block: string, name: string): string | null {
  const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i");
  const m = block.match(re);
  return m ? decodeXml(m[1]) : null;
}

function firstImage(block: string): string | null {
  const enc = block.match(/<media:content[^>]+url=["']([^"']+)["']/i);
  if (enc?.[1]) return enc[1];
  const thumb = block.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);
  if (thumb?.[1]) return thumb[1];
  const img = block.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (img?.[1]) return img[1];
  return null;
}

type RssItem = {
  title: string;
  link: string;
  description: string;
  pubDate: string | null;
  mediaUrl: string | null;
};

function parseRss(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const re = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    const title = tag(block, "title");
    const link = tag(block, "link");
    if (!title || !link) continue;
    items.push({
      title,
      link,
      description: tag(block, "description") ?? title,
      pubDate: tag(block, "pubDate"),
      mediaUrl: firstImage(block),
    });
  }
  return items;
}

function resolveFeeds(): Array<{ name: string; handle: string; url: string; logoUrl?: string }> {
  const raw = Deno.env.get("NEWS_RSS_FEEDS");
  if (!raw?.trim()) return DEFAULT_FEEDS;
  return raw
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean)
    .map((url, i) => {
      let logoUrl: string | undefined;
      try {
        logoUrl = `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`;
      } catch {
        logoUrl = undefined;
      }
      return {
        name: `Noticia ${i + 1}`,
        handle: "@NoticiasLocales",
        url,
        logoUrl,
      };
    });
}

function guessCategory(text: string): string | null {
  if (/\bbalacera\b|\btiroteo\b/i.test(text)) return "balacera";
  if (/\bnarcobloqueo\b/i.test(text)) return "narcobloqueo";
  if (/\benfrentamiento\b/i.test(text)) return "enfrentamiento";
  if (/\bdetonaci/i.test(text)) return "detonaciones";
  if (/\bbloqueo\b/i.test(text)) return "bloqueo";
  if (/\brobo\b|\basalto\b/i.test(text)) return "robo";
  if (/\baccidente\b|\bchoque\b/i.test(text)) return "accidente";
  if (/\balerta\b/i.test(text)) return "alerta";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ ok: false, error: "Missing Supabase env" }, 500);
  }
  if (!req.headers.get("authorization")) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const feeds = resolveFeeds();
  const rows: Array<Record<string, unknown>> = [];
  const errors: string[] = [];

  for (const feed of feeds) {
    try {
      const res = await fetch(feed.url, {
        headers: { "user-agent": "PulsoAlerty/1.0 (+community-rss)" },
      });
      if (!res.ok) {
        errors.push(`${feed.name}: HTTP ${res.status}`);
        continue;
      }
      const xml = await res.text();
      const items = parseRss(xml).slice(0, 12);
      for (const item of items) {
        const blob = `${item.title} ${item.description}`;
        // Preferir piezas locales / con señal de evento; no inundar con portada nacional.
        if (!EVENT_HINT.test(blob)) continue;

        const geo = geocodeCuliacanText(blob);
        const externalId = item.link.slice(0, 240);
        rows.push({
          source: "rss",
          external_id: externalId,
          author_handle: feed.handle,
          author_name: feed.name,
          text: item.description.slice(0, 800) || item.title,
          url: item.link,
          media_url: item.mediaUrl,
          author_avatar_url: feed.logoUrl ?? null,
          lat: geo?.lat ?? null,
          lng: geo?.lng ?? null,
          place_label: geo?.placeLabel ?? "Sinaloa (noticia)",
          created_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
          fetched_at: new Date().toISOString(),
          category_guess: guessCategory(blob),
          is_demo: false,
          trust_tier: "news",
        });
      }
    } catch (e) {
      errors.push(`${feed.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (rows.length === 0) {
    return json({
      ok: true,
      upserted: 0,
      feed_errors: errors,
      message: "Sin ítems RSS relevantes",
    });
  }

  const { error, data } = await admin
    .from("community_posts")
    .upsert(rows, { onConflict: "source,external_id" })
    .select("id");

  if (error) {
    console.error("upsert rss failed", error);
    return json({ ok: false, error: error.message, feed_errors: errors }, 500);
  }

  const withGeo = rows.filter((r) => r.lat != null && r.lng != null).length;
  return json({
    ok: true,
    upserted: data?.length ?? rows.length,
    with_geo: withGeo,
    feed_only: rows.length - withGeo,
    feed_errors: errors,
  });
});
