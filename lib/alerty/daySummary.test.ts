/**
 * Smoke tests del resumen de ventana (no hay Jest en package.json).
 * Run: npx tsx lib/alerty/daySummary.test.ts
 */
import { summarizeWindow } from "./daySummary";
import type { AlertItem } from "./types";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const alerta = (category: string, lat = 24.8, lng = -107.39): AlertItem =>
  ({ id: Math.random().toString(), category, lat, lng, createdAt: new Date().toISOString() }) as AlertItem;

function run() {
  // Sin nada: tranquilo, y no inventa una categoría.
  const vacio = summarizeWindow({ alerts: [], communityEvents: [], timeFilter: "24h" });
  assert(vacio.total === 0, "sin hechos, total 0");
  assert(vacio.tone === "tranquilo", "sin hechos, día tranquilo");
  assert(vacio.topCategory === null, "sin hechos, sin categoría");
  assert(vacio.cerca === null, "sin ubicación, cerca es null y no 0");

  // Un accidente no vuelve tenso el día.
  const leve = summarizeWindow({
    alerts: [alerta("accidente")],
    communityEvents: [],
    timeFilter: "24h",
  });
  assert(leve.tone === "tranquilo", `accidente solo no es grave, got ${leve.tone}`);
  assert(leve.total === 1, "cuenta el accidente");

  // Una balacera sí.
  const una = summarizeWindow({
    alerts: [alerta("balacera")],
    communityEvents: [],
    timeFilter: "24h",
  });
  assert(una.tone === "movido", `una balacera, got ${una.tone}`);
  assert(una.graves === 1, "una grave");

  // Tres graves definen el día.
  const tres = summarizeWindow({
    alerts: [alerta("balacera"), alerta("enfrentamiento"), alerta("sos")],
    communityEvents: [],
    timeFilter: "24h",
  });
  assert(tres.tone === "tenso", `tres graves, got ${tres.tone}`);

  // Los eventos de comunidad ya vienen agrupados: cuentan uno cada uno.
  const mixto = summarizeWindow({
    alerts: [alerta("balacera")],
    communityEvents: [{ category: "balacera", lat: 24.8, lng: -107.39 }],
    timeFilter: "6h",
  });
  assert(mixto.total === 2, `alertas + comunidad, got ${mixto.total}`);
  assert(mixto.topCategory === "balacera", "categoría más repetida");
  assert(mixto.windowLabel === "últimas 6 horas", `etiqueta de ventana, got ${mixto.windowLabel}`);

  // "Cerca" usa el radio de zona, no todo el mapa.
  const conUbicacion = summarizeWindow({
    alerts: [alerta("balacera", 24.8, -107.39), alerta("robo", 24.86, -107.45)],
    communityEvents: [],
    timeFilter: "24h",
    userLocation: { latitude: 24.8, longitude: -107.39 },
  });
  assert(conUbicacion.total === 2, "cuenta las dos en total");
  assert(conUbicacion.cerca === 1, `solo una dentro del radio, got ${conUbicacion.cerca}`);

  console.log("daySummary tests: OK");
}

run();
