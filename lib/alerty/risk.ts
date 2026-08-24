// Lógica de riesgo de zona — compartida por la consulta de dirección (puntual)
// y por el mapa de cuadrantes (cuadrícula). Se calcula 100% en cliente a partir
// de las alertas ya cargadas en el store.
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

// Evalúa el riesgo en un punto: suma ponderada de las alertas cercanas.
export const scoreAt = (
  alerts: AlertItem[],
  lat: number,
  lng: number,
  radiusKm = RISK_RADIUS_KM,
): RiskAssessment => {
  let score = 0;
  let count = 0;
  const catCounts = new Map<AlertCategory, number>();

  for (const alert of alerts) {
    if (calculateDistance(lat, lng, alert.lat, alert.lng) > radiusKm) continue;
    const w = alertWeight(alert);
    if (w <= 0) continue;
    score += w;
    count += 1;
    catCounts.set(alert.category, (catCounts.get(alert.category) ?? 0) + 1);
  }

  const byCategory = [...catCounts.entries()]
    .map(([category, c]) => ({ category, count: c }))
    .sort((a, b) => b.count - a.count);

  return { level: levelFromScore(score), score, count, byCategory };
};

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

// Construye la cuadrícula de cuadrantes: una celda coloreada por cada zona con
// al menos una alerta. Las celdas vacías no se dibujan (rendimiento + claridad).
export const buildRiskGrid = (
  alerts: AlertItem[],
  region: Region,
  cellDeg = RISK_CELL_DEG,
): GridCell[] => {
  const latMin = region.latitude - region.latitudeDelta / 2;
  const lngMin = region.longitude - region.longitudeDelta / 2;

  const cells = new Map<string, { score: number; count: number; row: number; col: number }>();

  for (const alert of alerts) {
    const w = alertWeight(alert);
    if (w <= 0) continue;
    const row = Math.floor((alert.lat - latMin) / cellDeg);
    const col = Math.floor((alert.lng - lngMin) / cellDeg);
    if (row < 0 || col < 0) continue;
    const key = `${row},${col}`;
    const cell = cells.get(key) ?? { score: 0, count: 0, row, col };
    cell.score += w;
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
