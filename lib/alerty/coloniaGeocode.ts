/**
 * Gazetteer + extracción de colonias (cliente).
 * Mantener alineado con supabase/functions/_shared/culiacanPlaces.ts
 */

export type CuliacanPlace = {
  name: string;
  lat: number;
  lng: number;
  aliases?: string[];
};

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
];

export type GeoSource = "tweet_coords" | "place_bbox" | "text_colonia" | "none";

type TextColoniaHit = {
  place: CuliacanPlace;
  score: number;
  matchedAs: string;
  index: number;
};

const EVENT_CONTEXT =
  /\b(ocurri[oó]\s+en|se\s+registr[oó]|reportan|reportan?\s+en|alerta\s+en|balacera\s+en|accidente\s+en|bloqueo\s+en|en\s+la\s+colonia|en\s+colonia|col\.\s*|colonia)\b/i;

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

function placeNames(place: CuliacanPlace): string[] {
  return [place.name, ...(place.aliases ?? [])];
}

function findPlaceByNameFragment(fragment: string): CuliacanPlace | null {
  const frag = normalize(fragment)
    .replace(/\b(de|del|la|las|los|el)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (frag.length < 3) return null;

  let best: { place: CuliacanPlace; len: number } | null = null;
  for (const place of CULIACAN_PLACES) {
    for (const n of placeNames(place)) {
      const nn = normalize(n);
      if (frag === nn || frag.includes(nn) || nn.includes(frag)) {
        const len = nn.length;
        if (!best || len > best.len) best = { place, len };
      }
    }
  }
  return best?.place ?? null;
}

export function extractColoniasFromText(text: string): TextColoniaHit[] {
  if (!text?.trim()) return [];
  const hay = text;
  const normHay = normalize(hay);
  const hits: TextColoniaHit[] = [];
  const seen = new Set<string>();

  let m: RegExpExecArray | null;
  const phraseRe = new RegExp(COLONIA_PHRASE.source, COLONIA_PHRASE.flags);
  while ((m = phraseRe.exec(hay)) !== null) {
    const raw = m[1].split(/[,.;:!?]| en | de Culiac/i)[0].trim();
    const place = findPlaceByNameFragment(raw);
    if (!place || seen.has(place.name)) continue;
    seen.add(place.name);
    const around = hay.slice(Math.max(0, m.index - 40), m.index + m[0].length + 10);
    const score = EVENT_CONTEXT.test(around) ? 100 : 80;
    hits.push({ place, score, matchedAs: raw, index: m.index });
  }

  const ranked = [...CULIACAN_PLACES].sort(
    (a, b) =>
      Math.max(...placeNames(b).map((n) => n.length)) -
      Math.max(...placeNames(a).map((n) => n.length)),
  );

  for (const place of ranked) {
    if (seen.has(place.name)) continue;
    for (const n of placeNames(place)) {
      const nn = normalize(n);
      if (nn.length < 4 && place.name !== "Centro") continue;
      const idx = normHay.indexOf(nn);
      if (idx < 0) continue;
      if (place.name === "Centro") {
        const window = hay.slice(Math.max(0, idx - 24), idx + nn.length + 24);
        if (!/\b(colonia|col\.?|centro de culiac|zona centro|en el centro)\b/i.test(window)) {
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

export function resolveTextColonia(text: string): {
  place: CuliacanPlace;
  confidence: "high" | "low";
  ambiguous: boolean;
  hits: TextColoniaHit[];
} | null {
  const hits = extractColoniasFromText(text);
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

function placeLabelLooksLikeCityOnly(label: string | null | undefined): boolean {
  if (!label) return true;
  const n = normalize(label);
  return (
    n === "culiacan" ||
    n === "culiacan sinaloa" ||
    n.includes("culiacan, sinaloa") ||
    n === "sinaloa" ||
    n.startsWith("culiacan (") ||
    n.startsWith("sinaloa (")
  );
}

function textColoniaDiffersFromPublisher(
  textPlace: CuliacanPlace,
  publisherLabel: string | null | undefined,
): boolean {
  if (!publisherLabel || placeLabelLooksLikeCityOnly(publisherLabel)) return true;
  const pub = normalize(publisherLabel);
  for (const n of placeNames(textPlace)) {
    const nn = normalize(n);
    if (pub.includes(nn) || nn.includes(pub)) return false;
  }
  for (const place of CULIACAN_PLACES) {
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
}): TextGeoResolution {
  const blob = [opts.title, opts.text].filter(Boolean).join("\n");
  const textHit = resolveTextColonia(blob);
  const placeNameSource = opts.publisherPlaceLabel?.trim() || null;

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
    textColoniaDiffersFromPublisher(textHit.place, placeNameSource);

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
    if (textHit && textHit.confidence === "high" && placeLabelLooksLikeCityOnly(placeNameSource)) {
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
      confidence: placeLabelLooksLikeCityOnly(placeNameSource) ? "low" : "high",
    };
  }

  if (textHit && !textHit.ambiguous) {
    return {
      lat: textHit.place.lat,
      lng: textHit.place.lng,
      placeLabel: textHit.place.name,
      geoSource: "text_colonia",
      placeNameSource,
      geocodedFromText: textHit.place.name,
      mapEligible: textHit.confidence === "high",
      confidence: textHit.confidence,
    };
  }

  return {
    lat: null,
    lng: null,
    placeLabel: placeNameSource ?? opts.fallbackLabel,
    geoSource: "none",
    placeNameSource,
    geocodedFromText: null,
    mapEligible: false,
    confidence: "none",
  };
}
