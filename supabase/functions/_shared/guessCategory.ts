/**
 * Clasificador compartido de categoría para sync-x-community y sync-news-rss.
 * Español, contexto Culiacán; acentos/case-insensitive.
 * Orden: categorías específicas primero; "alerta" solo como catch-all débil.
 */

export const CANONICAL_CATEGORIES = [
  "balacera",
  "enfrentamiento",
  "detonaciones",
  "narcobloqueo",
  "bloqueo",
  "captura",
  "robo",
  "accidente",
  "incendio",
  "inundacion",
  "zona segura",
  "sos",
  "desaparecida",
  "operativo",
  "alerta",
  "otro",
] as const;

export type CanonicalCategory = (typeof CANONICAL_CATEGORIES)[number];

/** Normaliza texto: minúsculas, sin acentos. */
export function normalizeEs(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

type Rule = { guess: CanonicalCategory; pattern: RegExp };

/**
 * Reglas en orden de prioridad. "alerta" va al final (solo si no hubo match fuerte).
 * "otro" no se asigna por keywords aquí — queda para noticias genéricas sin evento.
 */
const CATEGORY_RULES: Rule[] = [
  { guess: "sos", pattern: /\bsos\b|\bauxilio\b|\bpid(e|en) ayuda\b|\bauxilien\b/ },
  {
    guess: "desaparecida",
    pattern:
      /\bdesaparecid[oa]s?\b|\blevanton\b|\blevantamiento\b|\bprivacion de la libertad\b|\bsecuestro\b|\bplagiad[oa]s?\b|\bextraviad[oa]s?\b|\bbuscan a\b/,
  },
  {
    guess: "operativo",
    pattern:
      /\boperativo\b|\bdespliegue\b|\bmilitares?\b|\bejercito\b|\bguardia nacional\b|\bfederal(es)?\b|\brastrillo\b|\brevision de vehiculos\b/,
  },
  {
    guess: "balacera",
    pattern: /\bbalacera\b|\btiroteo\b|\bdisparos?\b|\bbalead[oa]s?\b|\brafagas?\b/,
  },
  {
    guess: "enfrentamiento",
    pattern:
      /\benfrentamiento\b|\bgrupo armado\b|\belementos armados\b|\bchoque armado\b|\btoma de cuartel\b/,
  },
  { guess: "detonaciones", pattern: /\bdetonaciones?\b|\bexplosiones?\b|\bestallidos?\b/ },
  {
    guess: "narcobloqueo",
    pattern: /\bnarcobloqueo\b|\bnarcobloqueos\b|\bvehiculos quemados en la via\b/,
  },
  {
    guess: "bloqueo",
    pattern:
      /\bbloqueo vial\b|\bbloqueos?\b|\btoma de (la )?(calle|avenida|carretera)\b|\bbarricadas?\b/,
  },
  {
    guess: "captura",
    pattern: /\bcaptura\b|\bdetenid[oa]s?\b|\barrestad[oa]s?\b|\basegurad[oa]s?\b|\bdetencion\b/,
  },
  {
    guess: "robo",
    pattern: /\brobo\b|\basalto\b|\braspon\b|\bcarjacking\b|\bportacion ilegal\b/,
  },
  {
    guess: "accidente",
    pattern: /\baccidente\b|\bchoque\b|\bvolcadura\b|\bcolision\b|\bpercance vial\b/,
  },
  {
    guess: "incendio",
    pattern: /\bincendio\b|\bse quema\b|\bconflagracion\b|\blamas\b|\bvehiculos? en llamas\b/,
  },
  {
    guess: "inundacion",
    pattern: /\binundacion\b|\binundad[oa]s?\b|\bencharcamiento\b|\bdesborde\b|\blluvias torrenciales\b/,
  },
  {
    guess: "zona segura",
    pattern: /\bzona segura\b|\btodo en calma\b|\bsin novedad\b|\bse restablece\b/,
  },
  {
    guess: "alerta",
    pattern: /\balerta\b|\balertan\b|\breportan\b|\bzona de riesgo\b|\bprecaucion\b/,
  },
];

/**
 * Clasifica texto libre al set canónico. Devuelve null si no hay señales.
 */
export function guessCategory(text: string): CanonicalCategory | null {
  const norm = normalizeEs(text);
  if (!norm.trim()) return null;
  for (const entry of CATEGORY_RULES) {
    if (entry.pattern.test(norm)) return entry.guess;
  }
  return null;
}
