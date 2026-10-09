/**
 * Capa de presentación: suaviza títulos alarmistas (MAYÚSCULAS, emojis de
 * sirena) sin tocar el dato original en DB. Pensado para feed, share y OG.
 */

const ALARMIST_EMOJI =
  /[\u{1F6A8}\u{1F525}\u{26A0}\u{1F4A5}\u{1F4A3}\u{1F480}\u{2620}\u{1F621}\u{1F92C}\u{1F624}]/gu;

const REDUNDANT_PREFIX =
  /^(urgente|última\s*hora|breaking|alerta\s*roja|atención|aviso\s*importante)\s*[:\-–—!]+\s*/i;

/** True si casi todo el texto útil está en mayúsculas (no solo siglas cortas). */
export function looksLikeAllCaps(text: string): boolean {
  const letters = text.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, "");
  if (letters.length < 8) return false;
  const upper = letters.replace(/[^A-ZÁÉÍÓÚÜÑ]/g, "").length;
  return upper / letters.length >= 0.75;
}

function toSentenceCase(text: string): string {
  const lower = text.toLocaleLowerCase("es-MX");
  return lower.replace(/(^|[.!?¿¡]\s+)(\p{L})/gu, (_, sep: string, ch: string) =>
    sep + ch.toLocaleUpperCase("es-MX"),
  );
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
    out = toSentenceCase(out);
  }

  // Recorta gritos de puntuación: "!!!!" → "!"
  out = out.replace(/([!?¡¿]){2,}/g, "$1");

  return out;
}
