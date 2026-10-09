/**
 * Capa de presentación: suaviza títulos alarmistas (MAYÚSCULAS, emojis,
 * links) sin tocar el dato original en DB. Respeta colonias/nombres propios.
 */

import { CULIACAN_PLACES } from "./coloniaGeocode";
import { MAZATLAN_PLACES } from "./places/mazatlanPlaces";

const ALARMIST_EMOJI =
  /[\u{1F6A8}\u{1F525}\u{26A0}\u{1F4A5}\u{1F4A3}\u{1F480}\u{2620}\u{1F621}\u{1F92C}\u{1F624}]/gu;

/** Pictográficos / emojis amplios (posts de X). */
const ANY_EMOJI = /\p{Extended_Pictographic}/gu;

const REDUNDANT_PREFIX =
  /^(urgente|última\s*hora|breaking|alerta\s*roja|atención|aviso\s*importante)\s*[:\-–—!]+\s*/i;

const URL_RE =
  /https?:\/\/\S+|www\.\S+|\b(?:t\.co|bit\.ly|goo\.gl|tinyurl\.com)\/\S+/gi;

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

/** Posts de X a menudo mezclan ALL CAPS con un “Sinaloa” o “más…” al final. */
export function mostlyShouting(text: string): boolean {
  if (looksLikeAllCaps(text)) return true;
  const words = text.split(/\s+/).filter((w) => /[\p{L}]{3,}/u.test(w));
  if (words.length < 2) return false;
  const shouting = words.filter((w) => {
    const letters = w.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, "");
    return (
      letters.length >= 3 &&
      letters === letters.toLocaleUpperCase("es-MX") &&
      /[A-ZÁÉÍÓÚÜÑ]/.test(letters)
    );
  });
  return shouting.length / words.length >= 0.5;
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

/** Oración: solo la primera letra en mayúscula; el gazetteer corrige nombres propios. */
export function toSentenceCaseEs(text: string): string {
  const lower = text.toLocaleLowerCase("es-MX");
  const m = lower.match(/^(\P{L}*)(\p{L})(.*)$/u);
  if (!m) return lower;
  return `${m[1]}${m[2].toLocaleUpperCase("es-MX")}${m[3]}`;
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
  for (const name of [
    "La Obregón",
    "Obregón",
    "Culiacán",
    "Mazatlán",
    "Sinaloa",
    "Bienestar",
  ]) {
    pairs.push({ needle: fold(name), canonical: name });
  }
  pairs.sort((a, b) => b.needle.length - a.needle.length);
  const seen = new Set<string>();
  return pairs.filter((p) => {
    if (seen.has(p.needle)) return false;
    seen.add(p.needle);
    return p.needle.length >= 3;
  });
}

const PLACE_CATALOG = buildPlaceCatalog();

/** Patrón que tolera tildes/ñ al buscar un nombre del gazetteer. */
function esFlexiblePattern(name: string): string {
  const vowel: Record<string, string> = {
    a: "[aáàäâ]",
    e: "[eéèëê]",
    i: "[iíìïî]",
    o: "[oóòöô]",
    u: "[uúùüû]",
    n: "[nñ]",
  };
  return [...name].map((ch) => {
    if (/\s/.test(ch)) return "\\s+";
    const lower = ch.toLocaleLowerCase("es-MX");
    if (vowel[lower]) return vowel[lower];
    return lower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }).join("");
}

/**
 * Sustituye menciones de colonias/ciudades por su casing canónico,
 * sin alterar el resto del texto.
 */
export function applyGazetteerCasing(text: string): string {
  let out = text;
  for (const { needle, canonical } of PLACE_CATALOG) {
    // needle está folded; reconstruimos patrón flexible desde el canónico.
    const flexible = esFlexiblePattern(canonical);
    const re = new RegExp(`(^|[^\\p{L}])(${flexible})(?![\\p{L}])`, "giu");
    out = out.replace(re, (_m, pre: string) => `${pre}${canonical}`);
  }
  return out;
}

/** Quita URLs, emojis, #hashtags (deja la palabra), @menciones finales y saltos. */
export function stripNoise(text: string): string {
  return text
    .replace(URL_RE, " ")
    .replace(ANY_EMOJI, " ")
    .replace(ALARMIST_EMOJI, " ")
    .replace(/[\u{FE0F}\u{200D}]/gu, "")
    .replace(/#(\p{L}[\p{L}\p{N}_]*)/gu, "$1")
    .replace(/(?:\s*@[A-Za-z0-9_]+)+\s*$/g, "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\b(más\s+info|más\s+detalles|ver\s+más|lee\s+más|click\s+aquí)\.?$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Recorte en límite de palabra con ellipsis tipográfico. */
export function truncateAtWord(text: string, maxLen: number): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  const budget = Math.max(8, maxLen - 1);
  const cut = t.slice(0, budget);
  const sp = cut.lastIndexOf(" ");
  const base = (sp >= Math.floor(budget * 0.45) ? cut.slice(0, sp) : cut).trimEnd();
  return `${base}…`;
}

/**
 * Normaliza un título para UI. Devuelve el original si ya se ve calmado.
 * Nunca muta storage: solo presentación.
 */
export function displayTitle(
  raw: string | null | undefined,
  fallback?: string,
): string {
  const base = stripNoise((raw ?? "").trim() || (fallback ?? "").trim());
  if (!base) return "Aviso en tu zona";

  let out = base.replace(REDUNDANT_PREFIX, "").trim() || base;

  if (mostlyShouting(out)) {
    out = toSentenceCaseEs(out);
  }

  out = applyGazetteerCasing(out);
  out = out.replace(/([!?¡¿]){2,}/g, "$1");

  return out;
}

/**
 * Título limpio para OG / share / landing de community posts:
 * sin links/emojis/saltos, casing de gazetteer, ~80 chars.
 */
export function cleanShareTitle(
  raw: string | null | undefined,
  fallback?: string,
  maxLen = 80,
): string {
  const titled = displayTitle(raw, fallback);
  return truncateAtWord(titled, maxLen);
}
