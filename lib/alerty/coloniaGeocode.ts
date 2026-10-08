/**
 * Gazetteer + extracción de colonias (cliente).
 * Culiacán: lista abajo. Mazatlán: places/mazatlanPlaces.ts.
 * Edge: supabase/functions/_shared/culiacanPlaces.ts (+ places/mazatlanPlaces.ts).
 */
import { getActiveCitySlug, type CitySlug } from "./city";
import {
  MAZATLAN_APPROX_LABEL,
  MAZATLAN_CITY_CENTER,
  MAZATLAN_PLACES,
} from "./places/mazatlanPlaces";
import type { CityPlace } from "./places/types";
import { calculateDistance } from "./utils";

export type CuliacanPlace = CityPlace;
export type { CityPlace };

export const CULIACAN_PLACES: CuliacanPlace[] = [
  { name: "Las Quintas", lat: 24.8099, lng: -107.3874 },
  { name: "Tres Ríos", lat: 24.821, lng: -107.4032, aliases: ["Tres Rios", "Tresrios"] },
  { name: "Centro", lat: 24.8057, lng: -107.3946, aliases: ["centro de Culiacán", "centro de Culiacan"] },
  { name: "Chapultepec", lat: 24.8175, lng: -107.3783 },
  { name: "La Campiña", lat: 24.8003, lng: -107.4023, aliases: ["La Campina"] },
  { name: "Barrancos", lat: 24.7733, lng: -107.4116 },
  { name: "Humaya", lat: 24.8264, lng: -107.4154 },
  { name: "Infonavit Humaya", lat: 24.836, lng: -107.417 },
  { name: "Stase", lat: 24.7937, lng: -107.3922 },
  { name: "Universidad", lat: 24.8255, lng: -107.3659 },
  { name: "Bachigualato", lat: 24.7581, lng: -107.4471 },
  { name: "Los Pinos", lat: 24.8116, lng: -107.3634 },
  { name: "La Conquista", lat: 24.8457, lng: -107.3743 },
  { name: "Azteca", lat: 24.7989, lng: -107.4311 },
  { name: "Guadalupe", lat: 24.7997, lng: -107.4068 },
  {
    name: "Adolfo López Mateos",
    lat: 24.7848,
    lng: -107.4015,
    aliases: ["Adolfo Lopez Mateos", "López Mateos", "Lopez Mateos", "Colonia López Mateos"],
  },
  { name: "Las Flores", lat: 24.7905, lng: -107.3842 },
  { name: "Villa Universidad", lat: 24.8351, lng: -107.3869 },
  { name: "6 de Enero", lat: 24.7863, lng: -107.3972, aliases: ["6 de enero"] },
  { name: "Loma de Rodriguera", lat: 24.8574, lng: -107.4161 },
  { name: "Boulevares", lat: 24.8189, lng: -107.4109 },
  { name: "Devísadero", lat: 24.79, lng: -107.39, aliases: ["Devisadero"] },
  { name: "Jardin", lat: 24.802, lng: -107.39, aliases: ["Jardín"] },
  { name: "Miguel Hidalgo", lat: 24.792, lng: -107.412, aliases: ["Hidalgo"] },
  { name: "Jorge Almada", lat: 24.808, lng: -107.41 },
  { name: "Lomas de San Isidro", lat: 24.83, lng: -107.42, aliases: ["San Isidro"] },
  { name: "Nuevo Culiacán", lat: 24.77, lng: -107.42, aliases: ["Nuevo Culiacan"] },
  { name: "Villa del Real", lat: 24.815, lng: -107.36 },
  { name: "Tierra Blanca", lat: 24.788, lng: -107.428 },
  { name: "Recursos Hidráulicos", lat: 24.812, lng: -107.428, aliases: ["Recursos Hidraulicos"] },
  { name: "Montebello", lat: 24.802, lng: -107.362 },
  { name: "La Forestal", lat: 24.834, lng: -107.398 },
  { name: "Guadalupe Victoria", lat: 24.776, lng: -107.388 },
  { name: "La Lima", lat: 24.822, lng: -107.378 },
  { name: "Las Torres", lat: 24.804, lng: -107.368 },
  { name: "El Vallado", lat: 24.772, lng: -107.392 },
  { name: "5 de Mayo", lat: 24.796, lng: -107.398, aliases: ["Cinco de Mayo"] },
  { name: "Los Ángeles", lat: 24.788, lng: -107.378, aliases: ["Los Angeles"] },
  { name: "Isla Musala", lat: 24.818, lng: -107.392, aliases: ["Musala"] },
  { name: "El Diez", lat: 24.732, lng: -107.448 },
  // Altas desde menciones reales en community_posts; coords de OpenStreetMap
  // (límite administrativo de la colonia), validadas dentro de Culiacán.
  { name: "Prados del Sur", lat: 24.7526, lng: -107.3799 },
  {
    // Los medios la escriben de cuatro formas distintas; OSM la registra con "Boulevard".
    // No confundir con Boulevares ni con el bulevar de Lomas de San Isidro.
    name: "Lomas del Boulevard",
    lat: 24.7882,
    lng: -107.4263,
    aliases: [
      "Lomas del Bulevar",
      "Lomas de Boulevard",
      "Lomas de Bulevar",
      "Lomas Boulevard",
      "Lomas Bulevar",
    ],
  },
  {
    // La colonia, no la avenida homónima: están a ~5 km una de otra.
    name: "Gustavo Díaz Ordaz",
    lat: 24.7702,
    lng: -107.4213,
    aliases: ["Gustavo Diaz Ordaz", "Díaz Ordaz", "Diaz Ordaz"],
  },
  { name: "Rafael Buelna", lat: 24.7883, lng: -107.3779 },
  { name: "Renato Vega", lat: 24.7804, lng: -107.3487, aliases: ["Renato Vega Amador"] },
  { name: "Felipe Ángeles", lat: 24.7616, lng: -107.4161, aliases: ["Felipe Angeles"] },
  { name: "Amado Nervo", lat: 24.7713, lng: -107.3918 },
  { name: "Los Mezcales", lat: 24.8578, lng: -107.395, aliases: ["Mezcales"] },
  { name: "Alturas del Sur", lat: 24.7632, lng: -107.3521 },
  {
    name: "Jesús María",
    lat: 24.9205,
    lng: -107.445,
    aliases: ["Jesus Maria", "sindicatura de Jesús María", "sindicatura de Jesus Maria"],
  },
];

const CULIACAN_CITY_CENTER = { lat: 24.8091, lng: -107.394 };
export const CITY_APPROX_LABEL = "Culiacán (aproximado)";

type CityGeoContext = {
  slug: CitySlug;
  places: CityPlace[];
  center: { lat: number; lng: number };
  approxLabel: string;
  mentionNeedles: string[];
  otherCityNeedles: string[];
};

const CULIACAN_OTHER = [
  "mazatlan",
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

const MAZATLAN_OTHER = [
  "culiacan",
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

export function getCityGeoContext(slug?: CitySlug): CityGeoContext {
  const resolved = slug ?? getActiveCitySlug();
  if (resolved === "mazatlan") {
    return {
      slug: "mazatlan",
      places: MAZATLAN_PLACES,
      center: MAZATLAN_CITY_CENTER,
      approxLabel: MAZATLAN_APPROX_LABEL,
      mentionNeedles: ["mazatlan"],
      otherCityNeedles: MAZATLAN_OTHER,
    };
  }
  return {
    slug: "culiacan",
    places: CULIACAN_PLACES,
    center: CULIACAN_CITY_CENTER,
    approxLabel: CITY_APPROX_LABEL,
    mentionNeedles: ["culiacan"],
    otherCityNeedles: CULIACAN_OTHER,
  };
}

export type GeoSource = "tweet_coords" | "place_bbox" | "text_colonia" | "none";

type TextColoniaHit = {
  place: CityPlace;
  score: number;
  matchedAs: string;
  index: number;
};

const EVENT_CONTEXT =
  /\b(ocurri[oó]\s+en|se\s+registr[oó]|reportan|reportan?\s+en|alerta\s+en|balacera\s+en|accidente\s+en|bloqueo\s+en|enfrentamiento\s+en|atacan?\s+en|en\s+la\s+colonia|en\s+colonia|col\.\s*|colonia)\b/i;

const COLONIA_PHRASE =
  /\b(?:en\s+la\s+)?(?:colonia|col\.?)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9][A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\s\-']{1,40})/gi;

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function placeNames(place: CityPlace): string[] {
  return [place.name, ...(place.aliases ?? [])];
}

function findPlaceByNameFragment(fragment: string, places: CityPlace[]): CityPlace | null {
  const frag = normalize(fragment)
    .replace(/\b(de|del|la|las|los|el)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (frag.length < 3) return null;

  let exact: CityPlace | null = null;
  let best: { place: CityPlace; len: number } | null = null;
  for (const place of places) {
    for (const n of placeNames(place)) {
      const nn = normalize(n);
      if (frag === nn) {
        if (!exact || nn.length > normalize(exact.name).length) exact = place;
      } else if (frag.includes(nn) || nn.includes(frag)) {
        const len = nn.length;
        if (!best || len > best.len) best = { place, len };
      }
    }
  }
  return exact ?? best?.place ?? null;
}

export function extractColoniasFromText(
  text: string,
  citySlug?: CitySlug,
): TextColoniaHit[] {
  if (!text?.trim()) return [];
  const { places } = getCityGeoContext(citySlug);
  const hay = text;
  const normHay = normalize(hay);
  const hits: TextColoniaHit[] = [];
  const seen = new Set<string>();

  let m: RegExpExecArray | null;
  const phraseRe = new RegExp(COLONIA_PHRASE.source, COLONIA_PHRASE.flags);
  while ((m = phraseRe.exec(hay)) !== null) {
    const raw = m[1].split(/[,.;:!?]| en | de Culiac| de Mazatl/i)[0].trim();
    const place = findPlaceByNameFragment(raw, places);
    if (!place || seen.has(place.name)) continue;
    seen.add(place.name);
    const around = hay.slice(Math.max(0, m.index - 40), m.index + m[0].length + 10);
    const score = EVENT_CONTEXT.test(around) ? 100 : 80;
    hits.push({ place, score, matchedAs: raw, index: m.index });
  }

  const ranked = [...places].sort(
    (a, b) =>
      Math.max(...placeNames(b).map((n) => n.length)) -
      Math.max(...placeNames(a).map((n) => n.length)),
  );

  for (const place of ranked) {
    if (seen.has(place.name)) continue;
    if (
      [...seen].some((name) => {
        const sn = normalize(name);
        const pn = normalize(place.name);
        return sn.includes(pn) || pn.includes(sn);
      })
    ) {
      continue;
    }
    for (const n of placeNames(place)) {
      const nn = normalize(n);
      if (nn.length < 4 && place.name !== "Centro") continue;
      const idx = normHay.indexOf(nn);
      if (idx < 0) continue;
      if (place.name === "Centro") {
        const window = hay.slice(Math.max(0, idx - 24), idx + nn.length + 24);
        if (
          !/\b(colonia|col\.?|centro de culiac|centro de mazatl|zona centro|en el centro)\b/i.test(
            window,
          )
        ) {
          continue;
        }
      }
      if (place.name === "Miguel Hidalgo" && normalize(n) === "hidalgo") {
        const window = hay.slice(Math.max(0, idx - 20), idx + nn.length + 12);
        if (!/\b(colonia|col\.?)\b/i.test(window)) continue;
      }
      seen.add(place.name);
      const origIdx = hay.toLowerCase().indexOf(n.toLowerCase());
      const around = hay.slice(
        Math.max(0, (origIdx >= 0 ? origIdx : 0) - 40),
        (origIdx >= 0 ? origIdx : 0) + n.length + 10,
      );
      const score = EVENT_CONTEXT.test(around) ? 70 : 40;
      hits.push({
        place,
        score,
        matchedAs: n,
        index: origIdx >= 0 ? origIdx : idx,
      });
      break;
    }
  }

  return hits.sort((a, b) => b.score - a.score || a.index - b.index);
}

export function resolveTextColonia(
  text: string,
  citySlug?: CitySlug,
): {
  place: CityPlace;
  confidence: "high" | "low";
  ambiguous: boolean;
  hits: TextColoniaHit[];
} | null {
  const hits = extractColoniasFromText(text, citySlug);
  if (hits.length === 0) return null;

  const top = hits[0];
  const rivals = hits.filter((h) => h.place.name !== top.place.name && h.score >= top.score - 15);

  if (rivals.length > 0 && top.score < 80) {
    return { place: top.place, confidence: "low", ambiguous: true, hits };
  }
  if (rivals.length > 0 && Math.abs(rivals[0].score - top.score) <= 5 && top.score < 100) {
    return { place: top.place, confidence: "low", ambiguous: true, hits };
  }

  const confidence: "high" | "low" = top.score >= 70 ? "high" : "low";
  return { place: top.place, confidence, ambiguous: false, hits };
}

function placeLabelLooksLikeCityOnly(
  label: string | null | undefined,
  ctx: CityGeoContext,
): boolean {
  if (!label) return true;
  const n = normalize(label);
  if (n === "sinaloa" || n.startsWith("sinaloa (")) return true;
  for (const needle of ctx.mentionNeedles) {
    if (
      n === needle ||
      n === `${needle} sinaloa` ||
      n.includes(`${needle}, sinaloa`) ||
      n.startsWith(`${needle} (`)
    ) {
      return true;
    }
  }
  return false;
}

export function isCityApproxLabel(label: string | null | undefined): boolean {
  return Boolean(label && /aproximad/i.test(label));
}

/** Historia de otra ciudad respecto a la ciudad activa (o `citySlug`). */
export function isOtherSinaloaCityStory(
  text: string,
  title?: string | null,
  citySlug?: CitySlug,
): boolean {
  const blob = [title, text].filter(Boolean).join("\n");
  const ctx = getCityGeoContext(citySlug);
  return mentionsOtherSinaloaCity(blob, ctx) && !mentionsActiveCity(blob, ctx);
}

function mentionsActiveCity(text: string, ctx: CityGeoContext): boolean {
  const n = normalize(text);
  return ctx.mentionNeedles.some((needle) => n.includes(needle));
}

function mentionsOtherSinaloaCity(text: string, ctx: CityGeoContext): boolean {
  const n = normalize(text);
  return ctx.otherCityNeedles.some((needle) => {
    const re = new RegExp(`\\b${needle.replace(/\s+/g, "\\s+")}\\b`);
    return re.test(n);
  });
}

function feedOnlyResolution(
  placeLabel: string,
  placeNameSource: string | null,
  geocodedFromText: string | null,
): TextGeoResolution {
  return {
    lat: null,
    lng: null,
    placeLabel,
    geoSource: "none",
    placeNameSource,
    geocodedFromText,
    mapEligible: false,
    confidence: "none",
  };
}

/** Spread city-level pins so they do not sit on one pixel. ~200–700 m. */
function cityApproxOffset(seed: string): { lat: number; lng: number } {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const angle = (h % 360) * (Math.PI / 180);
  const ring = 0.002 + ((h >>> 8) % 8) * 0.0006;
  return { lat: Math.sin(angle) * ring, lng: Math.cos(angle) * ring };
}

function cityApproxPin(
  seed: string,
  placeNameSource: string | null,
  ctx: CityGeoContext,
): TextGeoResolution {
  const offset = cityApproxOffset(seed);
  return {
    lat: ctx.center.lat + offset.lat,
    lng: ctx.center.lng + offset.lng,
    placeLabel: ctx.approxLabel,
    geoSource: "place_bbox",
    placeNameSource,
    geocodedFromText: null,
    mapEligible: true,
    confidence: "low",
  };
}

function textColoniaDiffersFromPublisher(
  textPlace: CityPlace,
  publisherLabel: string | null | undefined,
  ctx: CityGeoContext,
): boolean {
  if (!publisherLabel || placeLabelLooksLikeCityOnly(publisherLabel, ctx)) return true;
  const pub = normalize(publisherLabel);
  for (const n of placeNames(textPlace)) {
    const nn = normalize(n);
    if (pub.includes(nn) || nn.includes(pub)) return false;
  }
  for (const place of ctx.places) {
    if (place.name === textPlace.name) continue;
    for (const n of placeNames(place)) {
      const nn = normalize(n);
      if (nn.length >= 5 && pub.includes(nn)) return true;
    }
  }
  return true;
}

export type TextGeoResolution = {
  lat: number | null;
  lng: number | null;
  placeLabel: string;
  geoSource: GeoSource;
  placeNameSource: string | null;
  geocodedFromText: string | null;
  mapEligible: boolean;
  confidence: "high" | "low" | "none";
};

/** Misma política que supabase/functions/_shared/culiacanPlaces.ts */
export function resolveCommunityGeo(opts: {
  text: string;
  title?: string | null;
  coords?: { lat: number; lng: number } | null;
  placeBboxCenter?: { lat: number; lng: number } | null;
  publisherPlaceLabel?: string | null;
  fallbackLabel: string;
  allowCityApprox?: boolean;
  requireCuliacanMention?: boolean;
  requireCityMention?: boolean;
  citySlug?: CitySlug;
}): TextGeoResolution {
  const ctx = getCityGeoContext(opts.citySlug);
  const requireMention = opts.requireCityMention ?? opts.requireCuliacanMention ?? false;
  const blob = [opts.title, opts.text].filter(Boolean).join("\n");
  const textHit = resolveTextColonia(blob, ctx.slug);
  const placeNameSource = opts.publisherPlaceLabel?.trim() || null;
  const inCity = mentionsActiveCity(blob, ctx);
  const otherCity = mentionsOtherSinaloaCity(blob, ctx);

  if (otherCity && !inCity) {
    return feedOnlyResolution(placeNameSource ?? opts.fallbackLabel, placeNameSource, textHit?.place.name ?? null);
  }

  if (requireMention && !inCity) {
    return feedOnlyResolution(placeNameSource ?? opts.fallbackLabel, placeNameSource, textHit?.place.name ?? null);
  }

  if (textHit?.ambiguous) {
    return {
      lat: null,
      lng: null,
      placeLabel: placeNameSource ?? opts.fallbackLabel,
      geoSource: "none",
      placeNameSource,
      geocodedFromText: textHit.hits.map((h) => h.place.name).join(" | "),
      mapEligible: false,
      confidence: "none",
    };
  }

  const preferText =
    textHit &&
    textHit.confidence === "high" &&
    !otherCity &&
    textColoniaDiffersFromPublisher(textHit.place, placeNameSource, ctx);

  if (preferText && textHit) {
    return {
      lat: textHit.place.lat,
      lng: textHit.place.lng,
      placeLabel: textHit.place.name,
      geoSource: "text_colonia",
      placeNameSource,
      geocodedFromText: textHit.place.name,
      mapEligible: true,
      confidence: "high",
    };
  }

  if (opts.coords && Number.isFinite(opts.coords.lat) && Number.isFinite(opts.coords.lng)) {
    return {
      lat: opts.coords.lat,
      lng: opts.coords.lng,
      placeLabel: placeNameSource ?? textHit?.place.name ?? opts.fallbackLabel,
      geoSource: "tweet_coords",
      placeNameSource,
      geocodedFromText: textHit?.place.name ?? null,
      mapEligible: true,
      confidence: "high",
    };
  }

  if (
    opts.placeBboxCenter &&
    Number.isFinite(opts.placeBboxCenter.lat) &&
    Number.isFinite(opts.placeBboxCenter.lng)
  ) {
    if (textHit && textHit.confidence === "high" && placeLabelLooksLikeCityOnly(placeNameSource, ctx)) {
      return {
        lat: textHit.place.lat,
        lng: textHit.place.lng,
        placeLabel: textHit.place.name,
        geoSource: "text_colonia",
        placeNameSource,
        geocodedFromText: textHit.place.name,
        mapEligible: true,
        confidence: "high",
      };
    }
    return {
      lat: opts.placeBboxCenter.lat,
      lng: opts.placeBboxCenter.lng,
      placeLabel: placeNameSource ?? opts.fallbackLabel,
      geoSource: "place_bbox",
      placeNameSource,
      geocodedFromText: textHit?.place.name ?? null,
      mapEligible: true,
      confidence: placeLabelLooksLikeCityOnly(placeNameSource, ctx) ? "low" : "high",
    };
  }

  if (textHit && !textHit.ambiguous && textHit.confidence === "high" && !otherCity) {
    return {
      lat: textHit.place.lat,
      lng: textHit.place.lng,
      placeLabel: textHit.place.name,
      geoSource: "text_colonia",
      placeNameSource,
      geocodedFromText: textHit.place.name,
      mapEligible: true,
      confidence: "high",
    };
  }

  if (opts.allowCityApprox && inCity && !otherCity) {
    return cityApproxPin(blob, placeNameSource, ctx);
  }

  return {
    lat: null,
    lng: null,
    placeLabel: placeNameSource ?? opts.fallbackLabel,
    geoSource: "none",
    placeNameSource,
    geocodedFromText: textHit?.place.name ?? null,
    mapEligible: false,
    confidence: "none",
  };
}

/**
 * Mapa: coords persistidas, o colonia resuelta del texto.
 * Sin colonia clara no hay pin — el post vive en el Feed. Un pin de "ciudad
 * aproximada" cae sobre Centro y se lee como un evento ubicado ahí.
 */
export function resolveCommunityMapPoint(post: {
  lat: number | null;
  lng: number | null;
  text: string;
  source?: string | null;
  trustTier?: string | null;
  placeLabel?: string | null;
  categoryGuess?: string | null;
}): { lat: number; lng: number; placeLabel: string; approximate: boolean } | null {
  // Operativo: nunca pin en el mapa (ni por coords guardadas ni por colonia en texto).
  if (post.categoryGuess === "operativo") return null;
  const ctx = getCityGeoContext();

  if (
    typeof post.lat === "number" &&
    typeof post.lng === "number" &&
    Number.isFinite(post.lat) &&
    Number.isFinite(post.lng)
  ) {
    // Filas RSS ya guardadas con pin de ciudad: no pinchar aunque traigan lat/lng.
    if (isCityApproxLabel(post.placeLabel)) return null;
    return {
      lat: post.lat,
      lng: post.lng,
      placeLabel: post.placeLabel ?? ctx.approxLabel,
      approximate: false,
    };
  }
  const geo = resolveCommunityGeo({
    text: post.text,
    publisherPlaceLabel: post.placeLabel,
    fallbackLabel: post.placeLabel ?? ctx.approxLabel,
    requireCityMention: true,
    citySlug: ctx.slug,
  });
  if (!geo.mapEligible || geo.lat == null || geo.lng == null) return null;
  return {
    lat: geo.lat,
    lng: geo.lng,
    placeLabel: geo.placeLabel,
    approximate: geo.confidence !== "high",
  };
}

/** Autocomplete de colonias mientras el usuario escribe (ciudad activa). */
export function suggestDestinationPlaces(query: string, limit = 6): CityPlace[] {
  const n = normalize(query.trim());
  if (n.length < 1) return [];
  const { places } = getCityGeoContext();

  const scored: { place: CityPlace; score: number }[] = [];
  for (const place of places) {
    let best = 0;
    for (const name of placeNames(place)) {
      const nn = normalize(name);
      if (!nn) continue;
      if (nn === n) best = Math.max(best, 100);
      else if (nn.startsWith(n)) best = Math.max(best, 80 + Math.min(n.length, 15));
      else if (n.startsWith(nn) && nn.length >= 3) best = Math.max(best, 70);
      else if (n.length >= 2 && ` ${nn} `.includes(` ${n} `)) best = Math.max(best, 60);
      else if (n.length >= 2 && nn.includes(n)) best = Math.max(best, 40);
    }
    if (best > 0) scored.push({ place, score: best });
  }

  scored.sort((a, b) => b.score - a.score || a.place.name.localeCompare(b.place.name, "es"));
  const out: CityPlace[] = [];
  const seen = new Set<string>();
  for (const row of scored) {
    if (seen.has(row.place.name)) continue;
    seen.add(row.place.name);
    out.push(row.place);
    if (out.length >= limit) break;
  }
  return out;
}

/** Destino escrito por el usuario: colonia o zona de la ciudad activa. */
export function resolveDestinationQuery(query: string): { lat: number; lng: number; placeLabel: string } | null {
  const q = query.trim();
  if (q.length < 3) return null;
  const ctx = getCityGeoContext();

  const hit = resolveTextColonia(q, ctx.slug);
  if (hit && !hit.ambiguous) {
    return { lat: hit.place.lat, lng: hit.place.lng, placeLabel: hit.place.name };
  }

  const n = normalize(q);
  let exact: CityPlace | null = null;
  let best: { place: CityPlace; len: number } | null = null;
  for (const place of ctx.places) {
    for (const name of placeNames(place)) {
      const nn = normalize(name);
      if (nn.length < 3) continue;
      if (n === nn) {
        if (!exact || nn.length > normalize(exact.name).length) exact = place;
        continue;
      }
      const queryHasPlace = n.includes(nn) && nn.length >= 4;
      const placeStartsWithQuery = nn.startsWith(n) && n.length >= 4;
      const placeHasQueryWord = n.length >= 4 && ` ${nn} `.includes(` ${n} `);
      if (queryHasPlace || placeStartsWithQuery || placeHasQueryWord) {
        if (!best || nn.length > best.len) best = { place, len: nn.length };
      }
    }
  }
  const place = exact ?? best?.place ?? null;
  if (!place) return null;
  return { lat: place.lat, lng: place.lng, placeLabel: place.name };
}

export const nearestCuliacanPlace = (
  lat: number,
  lng: number,
  maxKm = 1.6,
): CityPlace | null => {
  const { places } = getCityGeoContext();
  let best: CityPlace | null = null;
  let bestKm = maxKm;
  for (const place of places) {
    const km = calculateDistance(lat, lng, place.lat, place.lng);
    if (km <= bestKm) {
      bestKm = km;
      best = place;
    }
  }
  return best;
};
