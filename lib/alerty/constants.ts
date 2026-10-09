import { getActiveCity } from "./city";

/**
 * Región del mapa de la ciudad activa (viva — sigue a la preferencia).
 * Alias histórico `CULIACAN_CENTER`: preferir `getActiveMapCenter()`.
 */
export function getActiveMapCenter() {
  return getActiveCity().center;
}

/**
 * Alias histórico. Usa getters para no congelar el centro al importar el módulo.
 */
export const CULIACAN_CENTER = {
  get latitude() {
    return getActiveCity().center.latitude;
  },
  get longitude() {
    return getActiveCity().center.longitude;
  },
  get latitudeDelta() {
    return getActiveCity().center.latitudeDelta;
  },
  get longitudeDelta() {
    return getActiveCity().center.longitudeDelta;
  },
};

/** Categorías que un ciudadano puede reportar (alerts.category). */
export const ALERT_CATEGORIES = [
  "balacera",
  "narcobloqueo",
  "enfrentamiento",
  "detonaciones",
  "bloqueo",
  "captura",
  "robo",
  "accidente",
  "incendio",
  "inundacion",
  "zona segura",
  "sos",
  "desaparecida",
  // "operativo" retirado del reporte ciudadano (halconeo / mapa en vivo).
] as const;

/**
 * Categorías solo de Pulsos (community_posts.category_guess).
 * `operativo` sigue clasificándose en noticias, pero no se reporta ni va al mapa
 * en vivo; ver lib/alerty/operativoPolicy.ts.
 */
export const COMMUNITY_EXTRA_CATEGORIES = ["alerta", "otro", "operativo"] as const;

/** Todas las categorías de pin / etiqueta (alertas + pulsos). */
export const PIN_CATEGORIES = [
  ...ALERT_CATEGORIES,
  ...COMMUNITY_EXTRA_CATEGORIES,
] as const;

/**
 * Chips de filtro (mapa / onboarding / ajustes). Sin operativo: no se filtra
 * en vivo; tras el delay aparece en listas sin depender del chip.
 */
export const MAP_FILTER_CATEGORIES = PIN_CATEGORIES.filter(
  (c) => c !== "operativo",
) as Exclude<(typeof PIN_CATEGORIES)[number], "operativo">[];

export const CATEGORY_LABELS: Record<(typeof PIN_CATEGORIES)[number], string> = {
  balacera: "Balacera",
  narcobloqueo: "Narcobloqueo",
  enfrentamiento: "Enfrentamiento",
  detonaciones: "Detonaciones",
  bloqueo: "Bloqueo Vial",
  captura: "Captura",
  robo: "Robo",
  accidente: "Accidente vial",
  incendio: "Incendio",
  inundacion: "Inundación",
  "zona segura": "Zona segura",
  sos: "SOS",
  desaparecida: "Persona desaparecida",
  operativo: "Operativo",
  alerta: "Alerta",
  otro: "Otro / noticia",
};

export const CATEGORY_ICONS: Record<(typeof PIN_CATEGORIES)[number], string> = {
  balacera: "warning",
  narcobloqueo: "car-outline",
  enfrentamiento: "warning-outline",
  detonaciones: "volume-high-outline",
  bloqueo: "nuclear-outline",
  captura: "checkmark-circle-outline",
  robo: "hand-right-outline",
  accidente: "car-sport-outline",
  incendio: "flame",
  inundacion: "water",
  "zona segura": "shield-checkmark-outline",
  sos: "alert-circle",
  desaparecida: "search",
  operativo: "shield",
  alerta: "alert",
  otro: "newspaper-outline",
};

export const REPUTATION_LEVELS = {
  CIUDADANO: { label: "Ciudadano", minScore: 0, radius: 2.0, color: "#666666", icon: "person" },
  VIGIA: { label: "Vigía", minScore: 20, radius: 5.0, color: "#2E7D32", icon: "eye" },
  PROTECTOR: { label: "Protector", minScore: 50, radius: 10.0, color: "#1565C0", icon: "shield" },
  HEROE: { label: "Héroe Local", minScore: 80, radius: 25.0, color: "#C62828", icon: "star" },
} as const;

export type ReputationLevel = keyof typeof REPUTATION_LEVELS;

export const getLevelProgress = (score: number) => {
  const levels = Object.entries(REPUTATION_LEVELS).sort(
    (a, b) => a[1].minScore - b[1].minScore,
  ) as [ReputationLevel, (typeof REPUTATION_LEVELS)[ReputationLevel]][];

  let currentIdx = 0;
  for (let i = 0; i < levels.length; i++) {
    if (score >= levels[i][1].minScore) currentIdx = i;
  }

  const [currentKey, current] = levels[currentIdx];
  const nextEntry = levels[currentIdx + 1] ?? null;
  const nextKey = nextEntry?.[0] ?? null;
  const next = nextEntry?.[1] ?? null;

  const pointsIntoLevel = score - current.minScore;
  const pointsForNext = next ? next.minScore - current.minScore : 0;

  return {
    currentKey,
    current,
    nextKey,
    next,
    progress: next ? Math.min(1, pointsIntoLevel / pointsForNext) : 1,
    pointsToNext: next ? Math.max(0, next.minScore - score) : 0,
  };
};

export const TIME_FILTERS = ["1h", "6h", "24h", "7d"] as const;

/** Radio del inbox Avisos y del badge de no leídas. */
export const AVISOS_RADIUS_KM = 5;

/** Radio del SOS: círculo en mapa + aviso a quienes están en la zona. */
export const SOS_RADIUS_KM = 2;

/**
 * Categorías donde grabar pone en riesgo a quien graba. Aquí la app no pide
 * video ni promete reputación por él: primero ponerse a salvo. Mismo criterio
 * que las críticas de notify-on-alert.
 */
export const DANGER_CATEGORIES: readonly string[] = [
  "sos",
  "balacera",
  "narcobloqueo",
  "enfrentamiento",
  "detonaciones",
  "incendio",
];

/** Confirmaciones recibidas para mostrar "Reportero confiable". */
export const RELIABLE_REPORTER_MIN_CONFIRMATIONS = 10;

/** Al final de la lista de Pulsos y de los videos. */
export const INFO_DISCLAIMER =
  "Pulso es una fuente informativa, no una verdad absoluta. Confirma con otras fuentes antes de actuar. Si ves algo que falta, publica un pulso; si algo está mal, confírmalo o desmiéntelo.";

/** Etiqueta corta de ventana para UI (Feed / Mapa). */
export const TIME_FILTER_WINDOW_LABEL: Record<(typeof TIME_FILTERS)[number], string> = {
  "1h": "última hora",
  "6h": "últimas 6 horas",
  "24h": "últimas 24 horas",
  "7d": "últimos 7 días",
};

export const TIME_FILTER_PILL_LABEL: Record<(typeof TIME_FILTERS)[number], string> = {
  "1h": "1 hora",
  "6h": "6 horas",
  "24h": "24 horas",
  "7d": "7 días",
};

/**
 * Colores de pin por categoría (tabla aprobada en board de Pulsos).
 * Usado en GlowMarker, CommunityMarker, badges, cards y filtros.
 */
export const CATEGORY_PIN_COLORS: Record<string, string> = {
  balacera: "#D9342B",
  enfrentamiento: "#A31D24",
  detonaciones: "#E9792F",
  narcobloqueo: "#74203F",
  bloqueo: "#F4A11D",
  captura: "#B5561F",
  robo: "#C79A1E",
  accidente: "#F2C83A",
  incendio: "#EF4B23",
  inundacion: "#2E7DD1",
  "zona segura": "#1F9D6E",
  sos: "#E0115F",
  alerta: "#FF7A59",
  desaparecida: "#8A4FD6",
  operativo: "#26418F",
  otro: "#6B7280",
};

/** Fallback para posts de comunidad sin categoryGuess. */
export const COMMUNITY_DEFAULT_PIN_COLOR = "#6B7280";

export const CULIACAN_NEIGHBORHOODS = [
  { name: "Las Quintas", latitude: 24.8099, longitude: -107.3874 },
  { name: "Tres Rios", latitude: 24.821, longitude: -107.4032 },
  { name: "Centro", latitude: 24.8057, longitude: -107.3946 },
  { name: "Chapultepec", latitude: 24.8175, longitude: -107.3783 },
  { name: "La Campina", latitude: 24.8003, longitude: -107.4023 },
  { name: "Barrancos", latitude: 24.7733, longitude: -107.4116 },
  { name: "Humaya", latitude: 24.8264, longitude: -107.4154 },
  { name: "Infonavit Humaya", latitude: 24.836, longitude: -107.417 },
  { name: "Stase", latitude: 24.7937, longitude: -107.3922 },
  { name: "Universidad", latitude: 24.8255, longitude: -107.3659 },
  { name: "Bachigualato", latitude: 24.7581, longitude: -107.4471 },
  { name: "Los Pinos", latitude: 24.8116, longitude: -107.3634 },
  { name: "La Conquista", latitude: 24.8457, longitude: -107.3743 },
  { name: "Azteca", latitude: 24.7989, longitude: -107.4311 },
  { name: "Guadalupe", latitude: 24.7997, longitude: -107.4068 },
  { name: "Adolfo Lopez Mateos", latitude: 24.7848, longitude: -107.4015 },
  { name: "Las Flores", latitude: 24.7905, longitude: -107.3842 },
  { name: "Villa Universidad", latitude: 24.8351, longitude: -107.3869 },
  { name: "6 de Enero", latitude: 24.7863, longitude: -107.3972 },
  { name: "Loma de Rodriguera", latitude: 24.8574, longitude: -107.4161 },
  { name: "Boulevares", latitude: 24.8189, longitude: -107.4109 },
];
