/** Mensajes y URLs de share sin dependencias de React Native (testeable con tsx). */

export const APP_SHARE_URL = "https://pulso-ciudadano.com";
export const APP_PRIVACY_URL = `${APP_SHARE_URL}/privacy`;

export function pulsePublicUrl(alertId: string): string {
  return `${APP_SHARE_URL}/p/${alertId}`;
}

export function alertDeepLink(alertId: string): string {
  return `${APP_SHARE_URL}/alert/${alertId}`;
}

export function dailySummaryShareMessage(opts: {
  cityName: string;
  total: number;
  byCategory: { label: string; count: number }[];
  cleared: number;
  allies: number;
  toneLabel: string;
}): string {
  const lines = [
    `Así estuvo ${opts.cityName} hoy`,
    opts.toneLabel,
    `${opts.total} ${opts.total === 1 ? "aviso" : "avisos"} en la comunidad`,
  ];
  for (const row of opts.byCategory.slice(0, 5)) {
    lines.push(`· ${row.label}: ${row.count}`);
  }
  if (opts.cleared > 0) {
    lines.push(
      opts.cleared === 1
        ? "1 zona ya se despejó"
        : `${opts.cleared} zonas ya se despejaron`,
    );
  }
  if (opts.allies > 0) {
    lines.push(
      opts.allies === 1
        ? "1 aliado/refugio cerca"
        : `${opts.allies} aliados/refugios cerca`,
    );
  }
  lines.push(`Mira el mapa: ${APP_SHARE_URL}`);
  return lines.join("\n");
}
