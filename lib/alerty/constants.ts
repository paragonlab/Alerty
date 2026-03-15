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
] as const;

export const CATEGORY_LABELS: Record<(typeof ALERT_CATEGORIES)[number], string> = {
  balacera: "Balacera",
  narcobloqueo: "Narcobloqueo",
  enfrentamiento: "Enfrentamiento",
  detonaciones: "Detonaciones",
  bloqueo: "Bloqueo",
  captura: "Captura",
  robo: "Robo",
  accidente: "Accidente",
  "zona segura": "Zona segura",
};

export const TIME_FILTERS = ["1h", "6h", "24h", "7d", "todo"] as const;

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
