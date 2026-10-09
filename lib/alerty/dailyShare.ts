/**
 * Resumen del día para estados de WhatsApp / IG — tono tranquilo de comunidad.
 */

import { CATEGORY_LABELS } from "./constants";
import { TONE_LABEL, type DaySummary, type DayTone } from "./daySummary";
import type { AlertItem } from "./types";
import { dailySummaryShareMessage } from "./shareCore";

export type DailyShareStats = {
  cityName: string;
  total: number;
  byCategory: { label: string; count: number }[];
  cleared: number;
  allies: number;
  toneLabel: string;
  tone: DayTone;
};

export function buildDailyShareStats(opts: {
  cityName: string;
  summary: DaySummary;
  alerts: AlertItem[];
  /** Aliados/refugios visibles hoy (sponsored). */
  alliesCount?: number;
  /** Pulsos marcados despejados en la ventana. */
  clearedCount?: number;
}): DailyShareStats {
  const counts = new Map<string, number>();
  for (const a of opts.alerts) {
    const c = a.category;
    if (!c) continue;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  const byCategory = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([cat, count]) => ({
      label:
        CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? cat,
      count,
    }));

  const cleared =
    opts.clearedCount ??
    opts.alerts.filter((a) => a.status === "resolved").length;

  return {
    cityName: opts.cityName,
    total: opts.summary.total,
    byCategory,
    cleared,
    allies: opts.alliesCount ?? 0,
    toneLabel: TONE_LABEL[opts.summary.tone],
    tone: opts.summary.tone,
  };
}

export function formatDailyShareMessage(stats: DailyShareStats): string {
  return dailySummaryShareMessage(stats);
}
