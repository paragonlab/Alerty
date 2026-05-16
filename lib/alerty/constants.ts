export const CULIACAN_CENTER = {
  latitude: 24.8091,
  longitude: -107.394,
  latitudeDelta: 0.16,
  longitudeDelta: 0.16,
};

export const ALERT_CATEGORIES = [
  "balacera",
  "narcobloqueo",
  "enfrentamiento",
  "detonaciones",
  "bloqueo",
  "captura",
  "robo",
  "accidente",
  "zona segura",
  "sos",
] as const;

export const CATEGORY_LABELS: Record<(typeof ALERT_CATEGORIES)[number], string> = {
  balacera: "Balacera",
  narcobloqueo: "Narcobloqueo",
  enfrentamiento: "Enfrentamiento",
  detonaciones: "Detonaciones",
  bloqueo: "Bloqueo Vial",
  captura: "Captura",
  robo: "Robo",
  accidente: "Accidente",
  "zona segura": "Zona segura",
  sos: "EMERGENCIA SOS",
};

export const CATEGORY_ICONS: Record<(typeof ALERT_CATEGORIES)[number], string> = {
  balacera: "warning",
  narcobloqueo: "car-outline",
  enfrentamiento: "warning-outline",
  detonaciones: "volume-high-outline",
  bloqueo: "nuclear-outline",
  captura: "checkmark-circle-outline",
  robo: "hand-right-outline",
  accidente: "car-sport-outline",
  "zona segura": "shield-checkmark-outline",
  sos: "alert-circle",
};

export const REPUTATION_LEVELS = {
  CIUDADANO: { label: "Ciudadano", minScore: 0, range: 2.0, color: "#666666", icon: "person" },
  VIGIA: { label: "Vigía", minScore: 20, range: 5.0, color: "#2E7D32", icon: "eye" },
  PROTECTOR: { label: "Protector", minScore: 50, range: 10.0, color: "#1565C0", icon: "shield" },
  HEROE: { label: "Héroe Local", minScore: 80, range: 25.0, color: "#C62828", icon: "star" },
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
  { name: "Las Flores", latitude: 24.7905, longitude: -107.3842 },
  { name: "Villa Universidad", latitude: 24.8351, longitude: -107.3869 },
  { name: "6 de Enero", latitude: 24.7863, longitude: -107.3972 },
  { name: "Loma de Rodriguera", latitude: 24.8574, longitude: -107.4161 },
  { name: "Boulevares", latitude: 24.8189, longitude: -107.4109 },
];
