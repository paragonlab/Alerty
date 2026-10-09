/**
 * Una línea útil por categoría: qué conviene hacer, sin tono de nota roja.
 * Se muestra bajo el título en feed/detalle/share/OG.
 * Categorías informativas (alerta/otro) no llevan línea de acción.
 */

import type { PinCategory } from "./types";

/** Noticias / avisos genéricos: sin consejo de “evitar la zona”. */
const NO_ACTION_CATEGORIES = new Set(["alerta", "otro"]);

export const CATEGORY_ACTION_LINE: Record<PinCategory, string> = {
  balacera: "Mejor evita la zona un rato y espera más avisos.",
  narcobloqueo: "Busca otra ruta; no te acerques a grabar.",
  enfrentamiento: "Aléjate con calma y no pases por ahí.",
  detonaciones: "Mantente lejos hasta que haya más reportes.",
  bloqueo: "Mejor rodea; el tráfico puede estar parado.",
  captura: "Puede haber retenes cercanos; pasa con paciencia.",
  robo: "Ten cuidado en la zona y avisa si ves algo raro.",
  accidente: "Pasa con precaución; puede haber lentitud.",
  incendio: "Aléjate del humo; no te acerques a grabar.",
  inundacion: "Evita calles bajas y zonas anegadas.",
  "zona segura": "Punto de referencia de vecinos en la zona.",
  sos: "Si puedes ayudar con seguridad, abre el mapa. No sustituye al 911.",
  desaparecida: "Comparte solo datos verificados; evita rumores.",
  operativo: "Información con retraso · sin ubicación en vivo.",
  alerta: "",
  otro: "",
};

export function showsActionLine(
  category: string | null | undefined,
): boolean {
  if (!category) return false;
  if (NO_ACTION_CATEGORIES.has(category)) return false;
  return Boolean(CATEGORY_ACTION_LINE[category as PinCategory]);
}

export function actionLineFor(
  category: string | null | undefined,
): string {
  if (!category || NO_ACTION_CATEGORIES.has(category)) return "";
  return CATEGORY_ACTION_LINE[category as PinCategory] ?? "";
}
