// Ingesta RSS de noticias locales por ciudad → community_posts (source=rss).
//
// Deploy:
//   supabase functions deploy sync-news-rss
//
// Por defecto recorre culiacan + mazatlan (citySyncConfig).
// Opcional: ?city=mazatlan | SYNC_CITY_SLUGS=culiacan,mazatlan
// Opcional feeds override (solo Culiacán): NEWS_RSS_FEEDS='https://...'
// Mazatlán: NEWS_RSS_FEEDS_MAZATLAN='https://...'
//
// Cron: un solo job; no duplicar crons por ciudad (evita doble lectura X; RSS es barato).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import {
  CITY_SYNC,
  isOtherCityStoryFor,
  mentionsCity,
  resolveSyncCitySlugs,
  type CitySyncConfig,
  type RssFeed,
  type SyncCitySlug,
} from "../_shared/citySyncConfig.ts";
import { resolveCommunityGeo } from "../_shared/culiacanPlaces.ts";
import { guessCategory } from "../_shared/guessCategory.ts";
import { stripOperativoGeo } from "../_shared/operativoPolicy.ts";

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

function feedsFromEnv(raw: string | undefined): RssFeed[] | null {
  if (!raw?.trim()) return null;
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

function resolveFeedsForCity(slug: SyncCitySlug, cfg: CitySyncConfig): RssFeed[] {
  if (slug === "culiacan") {
    return feedsFromEnv(Deno.env.get("NEWS_RSS_FEEDS")) ?? cfg.rssFeeds;
  }
  if (slug === "mazatlan") {
    return feedsFromEnv(Deno.env.get("NEWS_RSS_FEEDS_MAZATLAN")) ?? cfg.rssFeeds;
  }
  return cfg.rssFeeds;
}

async function syncCityRss(
  admin: ReturnType<typeof createClient>,
  cfg: CitySyncConfig,
): Promise<{ slug: SyncCitySlug; upserted: number; with_geo: number; feed_only: number; errors: string[] }> {
  const feeds = resolveFeedsForCity(cfg.slug, cfg);
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
        // Path por ciudad: Culiacán sigue rechazando Mazatlán-only; Mazatlán rechaza Culiacán-only.
        if (isOtherCityStoryFor(blob, cfg)) continue;
        if (!cfg.eventHint.test(blob) && !mentionsCity(blob, cfg)) continue;

        const excerpt = item.description.slice(0, 800) || item.title;
        const geo = resolveCommunityGeo({
          text: excerpt,
          title: item.title,
          publisherPlaceLabel: null,
          fallbackLabel: cfg.placeFallbackRss,
          requireCityMention: true,
          citySlug: cfg.slug,
        });
        const externalId = item.link.slice(0, 240);
        const categoryGuess = guessCategory(`${item.title} ${excerpt}`);
        rows.push(
          stripOperativoGeo({
            source: "rss",
            external_id: externalId,
            author_handle: feed.handle,
            author_name: feed.name,
            text: excerpt,
            url: item.link,
            media_url: item.mediaUrl,
            author_avatar_url: feed.logoUrl ?? null,
            lat: geo.mapEligible ? geo.lat : null,
            lng: geo.mapEligible ? geo.lng : null,
            place_label: geo.placeLabel,
            geo_source: geo.geoSource,
            place_name_source: geo.placeNameSource,
            geocoded_from_text: geo.geocodedFromText,
            created_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
            fetched_at: new Date().toISOString(),
            category_guess: categoryGuess,
            is_demo: false,
            trust_tier: "news",
            city_id: cfg.cityId,
          }),
        );
      }
    } catch (e) {
      errors.push(`${feed.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (rows.length === 0) {
    return { slug: cfg.slug, upserted: 0, with_geo: 0, feed_only: 0, errors };
  }

  const { error, data } = await admin
    .from("community_posts")
    .upsert(rows, { onConflict: "source,external_id" })
    .select("id");

  if (error) {
    errors.push(`upsert: ${error.message}`);
    return { slug: cfg.slug, upserted: 0, with_geo: 0, feed_only: 0, errors };
  }

  const withGeo = rows.filter((r) => r.lat != null && r.lng != null).length;
  return {
    slug: cfg.slug,
    upserted: data?.length ?? rows.length,
    with_geo: withGeo,
    feed_only: rows.length - withGeo,
    errors,
  };
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
  const slugs = resolveSyncCitySlugs(req);
  const cities: Array<Awaited<ReturnType<typeof syncCityRss>>> = [];

  for (const slug of slugs) {
    cities.push(await syncCityRss(admin, CITY_SYNC[slug]));
  }

  const upserted = cities.reduce((n, c) => n + c.upserted, 0);
  const with_geo = cities.reduce((n, c) => n + c.with_geo, 0);
  const feed_only = cities.reduce((n, c) => n + c.feed_only, 0);
  const feed_errors = cities.flatMap((c) => c.errors.map((e) => `${c.slug}: ${e}`));

  return json({
    ok: true,
    upserted,
    with_geo,
    feed_only,
    cities,
    feed_errors,
    message: upserted === 0 ? "Sin ítems RSS relevantes" : undefined,
  });
});
