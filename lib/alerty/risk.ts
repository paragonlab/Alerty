// Lógica de riesgo de zona — consulta puntual, calor y cuadrícula.
// Se calcula 100% en cliente a partir de alertas + posts de comunidad.
import type { AlertCategory, AlertItem } from "./types";
import { calculateDistance, getAlertAgeMinutes } from "./utils";

// Radio (km) que se considera "la zona" alrededor de un punto consultado.
export const RISK_RADIUS_KM = 0.8;

// Tamaño de celda de la cuadrícula de riesgo, en grados (~500 m).
export const RISK_CELL_DEG = 0.0045;

// Severidad relativa por categoría. Las categorías críticas pesan más.
const SEVERITY_WEIGHT: Record<string, number> = {
  sos: 3,
  balacera: 3,
  narcobloqueo: 2.5,
  enfrentamiento: 2.5,
  detonaciones: 2,
  incendio: 2.5,
  inundacion: 2,
  robo: 1.5,
  bloqueo: 1,
  captura: 1,
  accidente: 1,
  "zona segura": 0,
};

// Multiplicador según qué tan reciente es la alerta.
const recencyWeight = (createdAt: string): number => {
  const min = getAlertAgeMinutes(createdAt);
  if (min <= 30) return 2;
  if (min <= 180) return 1.4;
  if (min <= 1440) return 1;
  if (min <= 10080) return 0.4;
  return 0;
};

const alertWeight = (alert: AlertItem): number =>
  (SEVERITY_WEIGHT[alert.category] ?? 1) * recencyWeight(alert.createdAt);

/** X/RSS pesa menos que un reporte ciudadano para no inflar un geocode de colonia. */
const COMMUNITY_WEIGHT = 0.55;

export type WeightedPoint = {
  lat: number;
  lng: number;
  weight: number;
  category?: AlertCategory;
};

export const communityHeatWeight = (
  createdAt: string,
  categoryGuess?: string | null,
): number =>
  (SEVERITY_WEIGHT[categoryGuess ?? ""] ?? 0.8) * recencyWeight(createdAt) * COMMUNITY_WEIGHT;

export const toAlertHeatPoint = (alert: AlertItem): WeightedPoint | null => {
  const weight = alertWeight(alert);
  if (weight <= 0) return null;
  return { lat: alert.lat, lng: alert.lng, weight, category: alert.category };
};

export const toCommunityHeatPoint = (post: {
  lat: number;
  lng: number;
  createdAt: string;
  categoryGuess?: string | null;
}): WeightedPoint | null => {
  const weight = communityHeatWeight(post.createdAt, post.categoryGuess);
  if (weight <= 0) return null;
  const category = post.categoryGuess as AlertCategory | undefined;
  return { lat: post.lat, lng: post.lng, weight, category };
};

export const buildHeatPoints = (points: WeightedPoint[]) =>
  points.map((p) => ({ latitude: p.lat, longitude: p.lng, weight: p.weight }));

type HeatColors = { mapYellow: string; mapOrange: string; mapRed: string };

/** Color, radio (m) y opacidad del calor: más reciente/crítico = más rojo y grande. */
export const heatAppearance = (weight: number, colors: HeatColors) => {
  const w = Number.isFinite(weight) && weight > 0 ? weight : 1;
  const color = w >= 4 ? colors.mapRed : w >= 2 ? colors.mapOrange : colors.mapYellow;
  const radiusM = Math.round(Math.min(420, 140 + w * 48));
  const opacity = Math.min(0.4, 0.16 + 0.06 * Math.sqrt(w));
  const alpha = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, "0");
  return { color, radiusM, opacity, fillColor: `${color}${alpha}` };
};

export type RiskLevel = "tranquila" | "moderada" | "alta" | "critica";

export const levelFromScore = (score: number): RiskLevel => {
  if (score <= 0) return "tranquila";
  if (score <= 4) return "moderada";
  if (score <= 10) return "alta";
  return "critica";
};

export const RISK_LABEL: Record<RiskLevel, string> = {
  tranquila: "Zona tranquila",
  moderada: "Riesgo moderado",
  alta: "Riesgo alto",
  critica: "Riesgo crítico",
};

/** Respuesta de 2 segundos: ¿puedo salir? */
export const GO_OUT_LABEL: Record<RiskLevel, string> = {
  tranquila: "Puedes salir",
  moderada: "Sal con precaución",
  alta: "Mejor evítala",
  critica: "No salgas por aquí",
};

/** Destino: ¿es prudente ir? */
export const GO_DEST_LABEL: Record<RiskLevel, string> = {
  tranquila: "Es prudente ir",
  moderada: "Puedes ir con precaución",
  alta: "Mejor no vayas ahora",
  critica: "No es prudente ir",
};

type RiskColors = { success: string; mapYellow: string; mapOrange: string; mapRed: string };

export const riskColor = (level: RiskLevel, c: RiskColors): string => {
  switch (level) {
    case "tranquila":
      return c.success;
    case "moderada":
      return c.mapYellow;
    case "alta":
      return c.mapOrange;
    case "critica":
      return c.mapRed;
  }
};

export type RiskAssessment = {
  level: RiskLevel;
  score: number;
  count: number;
  byCategory: { category: AlertCategory; count: number }[];
};

export const scoreAtPoints = (
  points: WeightedPoint[],
  lat: number,
  lng: number,
  radiusKm = RISK_RADIUS_KM,
): RiskAssessment => {
  let score = 0;
  let count = 0;
  const catCounts = new Map<AlertCategory, number>();

  for (const point of points) {
    if (point.weight <= 0) continue;
    if (calculateDistance(lat, lng, point.lat, point.lng) > radiusKm) continue;
    score += point.weight;
    count += 1;
    if (point.category) {
      catCounts.set(point.category, (catCounts.get(point.category) ?? 0) + 1);
    }
  }

  const byCategory = [...catCounts.entries()]
    .map(([category, c]) => ({ category, count: c }))
    .sort((a, b) => b.count - a.count);

  return { level: levelFromScore(score), score, count, byCategory };
};

// Evalúa el riesgo en un punto: suma ponderada de las alertas cercanas.
export const scoreAt = (
  alerts: AlertItem[],
  lat: number,
  lng: number,
  radiusKm = RISK_RADIUS_KM,
): RiskAssessment =>
  scoreAtPoints(
    alerts.flatMap((alert) => {
      const point = toAlertHeatPoint(alert);
      return point ? [point] : [];
    }),
    lat,
    lng,
    radiusKm,
  );

export type GridCell = {
  id: string;
  level: RiskLevel;
  count: number;
  coordinates: { latitude: number; longitude: number }[];
};

type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export const buildRiskGridFromPoints = (
  points: WeightedPoint[],
  region: Region,
  cellDeg = RISK_CELL_DEG,
): GridCell[] => {
  const latMin = region.latitude - region.latitudeDelta / 2;
  const lngMin = region.longitude - region.longitudeDelta / 2;

  const cells = new Map<string, { score: number; count: number; row: number; col: number }>();

  for (const point of points) {
    if (point.weight <= 0) continue;
    const row = Math.floor((point.lat - latMin) / cellDeg);
    const col = Math.floor((point.lng - lngMin) / cellDeg);
    if (row < 0 || col < 0) continue;
    const key = `${row},${col}`;
    const cell = cells.get(key) ?? { score: 0, count: 0, row, col };
    cell.score += point.weight;
    cell.count += 1;
    cells.set(key, cell);
  }

  return [...cells.values()].map(({ score, count, row, col }) => {
    const south = latMin + row * cellDeg;
    const west = lngMin + col * cellDeg;
    const north = south + cellDeg;
    const east = west + cellDeg;
    return {
      id: `${row},${col}`,
      level: levelFromScore(score),
      count,
      coordinates: [
        { latitude: south, longitude: west },
        { latitude: north, longitude: west },
        { latitude: north, longitude: east },
        { latitude: south, longitude: east },
      ],
    };
  });
};

export const buildRiskGrid = (
  alerts: AlertItem[],
  region: Region,
  cellDeg = RISK_CELL_DEG,
): GridCell[] =>
  buildRiskGridFromPoints(
    alerts.flatMap((alert) => {
      const point = toAlertHeatPoint(alert);
      return point ? [point] : [];
    }),
    region,
    cellDeg,
  );
