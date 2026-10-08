/**
 * Config de ingesta X/RSS por ciudad (fase 2).
 * Preferir este módulo a más hardcodes de Culiacán en los sync jobs.
 */

import { CITY_IDS } from "./cities.ts";
import type { AllowlistEntry } from "./xAllowlist.ts";
import type { SyncCitySlug } from "./places/types.ts";

export type { SyncCitySlug };

export type RssFeed = {
  name: string;
  handle: string;
  url: string;
  logoUrl?: string;
};

export type CitySyncConfig = {
  slug: SyncCitySlug;
  cityId: string;
  name: string;
  /** Términos para Recent Search (≤512 chars con EVENT_TERMS). */
  placeTerms: string;
  placeFallbackX: string;
  placeFallbackRss: string;
  /** Formas normalizadas (sin acentos) que cuentan como mención de esta ciudad. */
  mentionNeedles: string[];
  /**
   * Otras ciudades de Sinaloa (normalizadas). Si el texto las menciona y NO
   * menciona esta ciudad → descartar en el path de sync de esta ciudad.
   */
  otherCityNeedles: string[];
  xAllowlist: AllowlistEntry[];
  rssFeeds: RssFeed[];
  /** Regex de evento; incluye mención de ciudad como señal débil. */
  eventHint: RegExp;
};

const SINALOA_OTHER_BASE = [
  "los mochis",
  "navolato",
  "guamuchil",
  "escuinapa",
  "el rosario",
  "concordia",
  "cosala",
  "guasave",
  "ahome",
  "el fuerte",
  "choix",
  "angostura",
  "salvador alvarado",
  "el dorado",
];

export const CITY_SYNC: Record<SyncCitySlug, CitySyncConfig> = {
  culiacan: {
    slug: "culiacan",
    cityId: CITY_IDS.culiacan,
    name: "Culiacán",
    placeTerms: "(Culiacán OR Culiacan OR #Culiacán)",
    placeFallbackX: "Culiacán (X)",
    placeFallbackRss: "Culiacán (noticia)",
    mentionNeedles: ["culiacan"],
    otherCityNeedles: ["mazatlan", ...SINALOA_OTHER_BASE],
    xAllowlist: [
      { handle: "LineaDirectaMX", tier: "medio" },
      { handle: "DebateCuliacan", tier: "medio" },
      { handle: "ElDebate", tier: "medio" },
      { handle: "Riodoce", tier: "medio" },
      { handle: "Noroeste", tier: "medio" },
      { handle: "SSPSinaloa", tier: "oficial" },
      { handle: "CuliacanGob", tier: "oficial" },
      { handle: "PC_Culiacan", tier: "oficial" },
      { handle: "FGESinaloa", tier: "oficial" },
    ],
    rssFeeds: [
      {
        name: "Línea Directa",
        handle: "@LineaDirectaMX",
        url: "https://lineadirectaportal.com/feed",
        logoUrl: "https://www.google.com/s2/favicons?domain=lineadirectaportal.com&sz=64",
      },
      {
        name: "Noroeste",
        handle: "@Noroeste",
        url: "https://www.noroeste.com.mx/rss/portada.xml",
        logoUrl: "https://www.google.com/s2/favicons?domain=noroeste.com.mx&sz=64",
      },
    ],
    eventHint:
      /\b(alerta|balacera|tiroteo|accidente|bloqueo|detonaci|enfrentamiento|asalto|robo|narcobloqueo|choque|incendio|inundaci|persecuci|culiac[aá]n)\b/i,
  },
  mazatlan: {
    slug: "mazatlan",
    cityId: CITY_IDS.mazatlan,
    name: "Mazatlán",
    placeTerms: "(Mazatlán OR Mazatlan OR #Mazatlán OR #Mazatlan)",
    placeFallbackX: "Mazatlán (X)",
    placeFallbackRss: "Mazatlán (noticia)",
    mentionNeedles: ["mazatlan"],
    // En path Mazatlán, Culiacán (y el resto) son "otra ciudad".
    otherCityNeedles: ["culiacan", ...SINALOA_OTHER_BASE],
    xAllowlist: [
      { handle: "noroestemx", tier: "medio" },
      { handle: "Noroeste", tier: "medio" },
      { handle: "noticieristas", tier: "medio" },
      { handle: "luznoticiasmx", tier: "medio" },
      { handle: "ElSoldeMzt", tier: "medio" },
      { handle: "JesusColio", tier: "medio" },
      { handle: "EditorMzt", tier: "medio" },
      { handle: "LineaDirectaMX", tier: "medio" },
      { handle: "MennyValdz", tier: "medio" },
      { handle: "SSPSinaloa", tier: "oficial" },
      { handle: "FGESinaloa", tier: "oficial" },
    ],
    rssFeeds: [
      {
        name: "El Sol de Mazatlán",
        handle: "@ElSoldeMzt",
        url: "https://oem.com.mx/elsoldemazatlan/rss",
        logoUrl: "https://www.google.com/s2/favicons?domain=oem.com.mx&sz=64",
      },
      {
        name: "Los Noticieristas",
        handle: "@noticieristas",
        url: "https://losnoticieristas.com/feed/",
        logoUrl: "https://www.google.com/s2/favicons?domain=losnoticieristas.com&sz=64",
      },
      {
        name: "Línea Directa",
        handle: "@LineaDirectaMX",
        url: "https://lineadirectaportal.com/feed",
        logoUrl: "https://www.google.com/s2/favicons?domain=lineadirectaportal.com&sz=64",
      },
      {
        name: "El Sol de Sinaloa",
        handle: "@ElSoldedeSinaloa",
        url: "https://oem.com.mx/elsoldesinaloa/rss",
        logoUrl: "https://www.google.com/s2/favicons?domain=oem.com.mx&sz=64",
      },
    ],
    eventHint:
      /\b(alerta|balacera|tiroteo|accidente|bloqueo|detonaci|enfrentamiento|asalto|robo|narcobloqueo|choque|incendio|inundaci|persecuci|hurac[aá]n|oleaje|socav[oó]n|mazatl[aá]n)\b/i,
  },
};

/** Ciudades que el cron de sync recorre por defecto (fase 2). */
export const DEFAULT_SYNC_CITY_SLUGS: SyncCitySlug[] = ["culiacan", "mazatlan"];

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function mentionsCity(text: string, cfg: CitySyncConfig): boolean {
  const n = normalizeText(text);
  return cfg.mentionNeedles.some((needle) => n.includes(needle));
}

/** Historia de otra ciudad (sin mención de la ciudad del path de sync). */
export function isOtherCityStoryFor(text: string, cfg: CitySyncConfig): boolean {
  const n = normalizeText(text);
  const mentionsSelf = cfg.mentionNeedles.some((needle) => n.includes(needle));
  if (mentionsSelf) return false;
  return cfg.otherCityNeedles.some((needle) => {
    const re = new RegExp(`\\b${needle.replace(/\s+/g, "\\s+")}\\b`);
    return re.test(n);
  });
}

export function parseSyncCitySlugs(raw: string | null | undefined): SyncCitySlug[] {
  if (!raw?.trim()) return DEFAULT_SYNC_CITY_SLUGS;
  const out: SyncCitySlug[] = [];
  for (const part of raw.split(",")) {
    const s = part.trim().toLowerCase();
    if (s === "culiacan" || s === "mazatlan") {
      if (!out.includes(s)) out.push(s);
    }
  }
  return out.length > 0 ? out : DEFAULT_SYNC_CITY_SLUGS;
}

/** Query param ?city= / body.city / env SYNC_CITY_SLUGS. */
export function resolveSyncCitySlugs(req: Request): SyncCitySlug[] {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get("city") ?? url.searchParams.get("cities");
  if (fromQuery?.trim()) return parseSyncCitySlugs(fromQuery);
  return parseSyncCitySlugs(Deno.env.get("SYNC_CITY_SLUGS"));
}

export function mergeCityAllowlist(
  cityList: AllowlistEntry[],
  envRaw?: string,
): AllowlistEntry[] {
  const fromEnv: AllowlistEntry[] = [];
  if (envRaw?.trim()) {
    for (const part of envRaw.split(",")) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const [handleRaw, tierRaw] = trimmed.split(":");
      const handle = (handleRaw ?? "").replace(/^@/, "").trim();
      if (!handle) continue;
      const tier = tierRaw?.trim() === "oficial" ? "oficial" : "medio";
      fromEnv.push({ handle, tier });
    }
  }
  const map = new Map<string, AllowlistEntry>();
  for (const e of [...cityList, ...fromEnv]) {
    map.set(e.handle.toLowerCase(), { handle: e.handle, tier: e.tier });
  }
  return Array.from(map.values());
}
