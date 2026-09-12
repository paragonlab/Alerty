/**
 * Resumen de la ventana elegida: qué tan movido está el día y qué pasó cerca.
 *
 * Existe sobre todo para el primer uso. Un mapa sin pines cerca no significa
 * que no pase nada — significa que nada de lo que sabemos tiene ubicación
 * confirmada ahí. Un mapa vacío sin explicación se lee como app muerta.
 *
 * La etiqueta es un atajo; el número es la verdad. Siempre se muestran los dos,
 * para que nadie tenga que confiar en una palabra que eligió un heurístico.
 */
import type { AlertCategory, AlertItem, TimeFilter } from "./types";
import { TIME_FILTER_WINDOW_LABEL } from "./constants";
import { calculateDistance } from "./utils";
import { RISK_RADIUS_KM } from "./risk";

/** Categorías que cambian la decisión de salir o no. */
const GRAVES = new Set([
  "sos",
  "balacera",
  "enfrentamiento",
  "narcobloqueo",
  "detonaciones",
]);

export type DayTone = "tranquilo" | "movido" | "tenso";

export type DaySummary = {
  /** Hechos distintos en la ventana: alertas + eventos de comunidad ya agrupados. */
  total: number;
  /** Cuántos de esos son de categoría grave. */
  graves: number;
  /** Categoría más repetida, o null si no hubo nada. */
  topCategory: AlertCategory | null;
  /** Hechos dentro del radio de zona del usuario; null si no dio ubicación. */
  cerca: number | null;
  tone: DayTone;
  windowLabel: string;
};

export const TONE_LABEL: Record<DayTone, string> = {
  tranquilo: "Día tranquilo",
  movido: "Día movido",
  tenso: "Día tenso",
};

type SummaryPoint = {
  category?: AlertCategory | string | null;
  /**
   * Opcionales a propósito: un hecho sin colonia confirmada sigue siendo un
   * hecho y cuenta para el total. Solo queda fuera de "cerca", que sí necesita
   * coordenadas. Si se exigieran, el resumen diría "día tranquilo" justo cuando
   * hay decenas de reportes que no pudimos ubicar — el peor momento para callar.
   */
  lat?: number | null;
  lng?: number | null;
};

/**
 * Un hecho grave ya cambia el día; tres lo definen. Los umbrales son bajos a
 * propósito: en Culiacán la diferencia entre uno y ninguno importa más que
 * entre diez y veinte.
 */
function toneFor(graves: number): DayTone {
  if (graves === 0) return "tranquilo";
  if (graves <= 2) return "movido";
  return "tenso";
}

export function summarizeWindow(opts: {
  alerts: AlertItem[];
  /** Eventos de comunidad YA agrupados: un hecho cubierto por 11 medios es uno. */
  communityEvents: SummaryPoint[];
  timeFilter: TimeFilter;
  userLocation?: { latitude: number; longitude: number } | null;
}): DaySummary {
  const points: SummaryPoint[] = [
    ...opts.alerts.map((a) => ({ category: a.category, lat: a.lat, lng: a.lng })),
    ...opts.communityEvents,
  ];

  const counts = new Map<string, number>();
  let graves = 0;
  for (const p of points) {
    const c = p.category ?? "";
    if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
    if (GRAVES.has(c)) graves += 1;
  }

  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];

  let cerca: number | null = null;
  if (opts.userLocation) {
    const aqui = opts.userLocation;
    cerca = points.filter(
      (p) =>
        typeof p.lat === "number" &&
        typeof p.lng === "number" &&
        calculateDistance(aqui.latitude, aqui.longitude, p.lat, p.lng) <= RISK_RADIUS_KM,
    ).length;
  }

  return {
    total: points.length,
    graves,
    topCategory: (top?.[0] as AlertCategory) ?? null,
    cerca,
    tone: toneFor(graves),
    windowLabel: TIME_FILTER_WINDOW_LABEL[opts.timeFilter],
  };
}
