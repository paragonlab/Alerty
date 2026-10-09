/**
 * Capa de presentación: suaviza títulos alarmistas (MAYÚSCULAS, emojis de
 * sirena) sin tocar el dato original en DB. Respeta colonias/nombres propios.
 */

import { CULIACAN_PLACES } from "./coloniaGeocode";
import { MAZATLAN_PLACES } from "./places/mazatlanPlaces";

const ALARMIST_EMOJI =
  /[\u{1F6A8}\u{1F525}\u{26A0}\u{1F4A5}\u{1F4A3}\u{1F480}\u{2620}\u{1F621}\u{1F92C}\u{1F624}]/gu;

const REDUNDANT_PREFIX =
  /^(urgente|última\s*hora|breaking|alerta\s*roja|atención|aviso\s*importante)\s*[:\-–—!]+\s*/i;

/** Artículos/preposiciones que no se capitalizan en medio de un nombre. */
const SMALL_WORDS = new Set([
  "a",
  "al",
  "con",
  "de",
  "del",
  "el",
  "en",
  "la",
  "las",
  "los",
  "para",
  "por",
  "un",
  "una",
  "y",
]);

/** True si casi todo el texto útil está en mayúsculas (no solo siglas cortas). */
export function looksLikeAllCaps(text: string): boolean {
  const letters = text.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, "");
  if (letters.length < 8) return false;
  const upper = letters.replace(/[^A-ZÁÉÍÓÚÜÑ]/g, "").length;
  return upper / letters.length >= 0.75;
}

/** Title case español: capitaliza palabras; small words en minúscula salvo al inicio. */
export function toTitleCaseEs(text: string): string {
  const parts = text.toLocaleLowerCase("es-MX").split(/(\s+)/);
  let wordIndex = 0;
  return parts
    .map((part) => {
      if (/^\s+$/.test(part) || part.length === 0) return part;
      const isFirst = wordIndex === 0;
      wordIndex += 1;
      if (!isFirst && SMALL_WORDS.has(part)) return part;
      return part.charAt(0).toLocaleUpperCase("es-MX") + part.slice(1);
    })
    .join("");
}

type PlaceEntry = { name: string; aliases?: string[] };

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("es-MX");
}

/** Nombres canónicos (más aliases) ordenados por longitud desc para replaces. */
function buildPlaceCatalog(extra: PlaceEntry[] = []): { needle: string; canonical: string }[] {
  const entries: PlaceEntry[] = [...CULIACAN_PLACES, ...MAZATLAN_PLACES, ...extra];
  const pairs: { needle: string; canonical: string }[] = [];
  for (const p of entries) {
    pairs.push({ needle: fold(p.name), canonical: p.name });
    for (const a of p.aliases ?? []) {
      pairs.push({ needle: fold(a), canonical: p.name });
    }
  }
  // Lugares frecuentes fuera del gazetteer corto (medios los escriben así).
  for (const name of ["La Obregón", "Obregón", "Culiacán", "Mazatlán", "Sinaloa"]) {
    pairs.push({ needle: fold(name), canonical: name });
  }
  pairs.sort((a, b) => b.needle.length - a.needle.length);
  // Dedup por needle: primer (más largo / primero) gana.
  const seen = new Set<string>();
  return pairs.filter((p) => {
    if (seen.has(p.needle)) return false;
    seen.add(p.needle);
    return p.needle.length >= 3;
  });
}

const PLACE_CATALOG = buildPlaceCatalog();

/**
 * Sustituye menciones de colonias/ciudades por su casing canónico,
 * sin alterar el resto del texto.
 */
export function applyGazetteerCasing(text: string): string {
  let out = text;
  for (const { needle, canonical } of PLACE_CATALOG) {
    // Word-ish boundaries sin lookbehind (Hermes / Node amplios).
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    const re = new RegExp(`(^|[^\\p{L}])(${escaped})(?![\\p{L}])`, "giu");
    out = out.replace(re, (_m, pre: string) => `${pre}${canonical}`);
  }
  return out;
}

/**
 * Normaliza un título para UI. Devuelve el original si ya se ve calmado.
 * Nunca muta storage: solo presentación.
 */
export function displayTitle(
  raw: string | null | undefined,
  fallback?: string,
): string {
  const base = (raw ?? "").trim() || (fallback ?? "").trim();
  if (!base) return "Aviso en tu zona";

  let out = base
    .replace(ALARMIST_EMOJI, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  out = out.replace(REDUNDANT_PREFIX, "").trim() || out;

  if (looksLikeAllCaps(out)) {
    // Title case (no solo sentence case) para no dejar "la obregón".
    out = toTitleCaseEs(out);
  }

  out = applyGazetteerCasing(out);

  // Recorta gritos de puntuación: "!!!!" → "!"
  out = out.replace(/([!?¡¿]){2,}/g, "$1");

  return out;
}
