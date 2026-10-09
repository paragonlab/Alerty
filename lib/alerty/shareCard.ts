/**
 * Datos y markup de la tarjeta-imagen para compartir un pulso.
 * En web se exporta como SVG (data URL); WhatsApp usa además OG del link /p/<id>.
 * Nunca incluye coordenadas precisas de operativo en vivo.
 */

import { actionLineFor } from "./actionLines";
import { CATEGORY_LABELS, CATEGORY_PIN_COLORS } from "./constants";
import { cleanShareTitle } from "./displayTitle";
import { isOperativoCategory } from "./operativoPolicy";
import {
  APP_SHARE_URL,
  pulsePublicUrl,
  type PulseShareKind,
} from "./shareCore";

/** Ancho útil del titular en la tarjeta (evita el círculo derecho). */
const SHARE_TITLE_MAX_CHARS = 32;
const SHARE_TITLE_MAX_LINES = 3;

export type ShareCardInput = {
  id: string;
  category: string;
  title?: string | null;
  placeLabel?: string | null;
  cityName: string;
  /** Si es operativo aún en delay, no mostrar pin/coords. */
  createdAt?: string | null;
  status?: "active" | "resolved";
  actionLine?: string;
  kind?: PulseShareKind;
};

export type ShareCardModel = {
  url: string;
  headline: string;
  categoryLabel: string;
  placeLine: string;
  actionLine: string;
  cityName: string;
  accent: string;
  cleared: boolean;
  showMapHint: boolean;
};

export function buildShareCardModel(input: ShareCardInput): ShareCardModel {
  const operativo = isOperativoCategory(input.category);
  const place =
    operativo || !input.placeLabel?.trim()
      ? input.cityName
      : input.placeLabel.trim();

  const categoryLabel =
    CATEGORY_LABELS[input.category as keyof typeof CATEGORY_LABELS] ??
    input.category;

  const headline = cleanShareTitle(input.title, categoryLabel, 120);
  const action = input.actionLine ?? actionLineFor(input.category);
  const accent = CATEGORY_PIN_COLORS[input.category] ?? "#6B7280";

  return {
    url: pulsePublicUrl(input.id, input.kind ?? "alert"),
    headline,
    categoryLabel,
    placeLine: place,
    actionLine: action,
    cityName: input.cityName,
    accent,
    cleared: input.status === "resolved",
    showMapHint: !operativo,
  };
}

export function sharePulseMessage(model: ShareCardModel): string {
  const lines = [`Pulso · ${model.placeLine}`, model.headline];
  if (model.actionLine.trim()) lines.push(model.actionLine);
  if (model.cleared) lines.push("Ya se despejó ✓");
  lines.push(model.url);
  return lines.join("\n");
}

/** Wrap simple por caracteres (SVG share sin métricas de fuente). */
function wrapShareHeadline(text: string): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return ["Aviso en tu zona"];
  const lines: string[] = [];
  let i = 0;
  while (i < words.length && lines.length < SHARE_TITLE_MAX_LINES) {
    let line = words[i++];
    while (i < words.length) {
      const trial = `${line} ${words[i]}`;
      if (trial.length > SHARE_TITLE_MAX_CHARS) break;
      line = trial;
      i += 1;
    }
    lines.push(line);
  }
  if (i < words.length) {
    const last = lines[lines.length - 1] ?? "";
    const budget = Math.max(8, SHARE_TITLE_MAX_CHARS - 1);
    const cut = last.slice(0, budget);
    const sp = cut.lastIndexOf(" ");
    const base = (sp >= Math.floor(budget * 0.45) ? cut.slice(0, sp) : cut).trimEnd();
    lines[lines.length - 1] = `${base.replace(/…$/u, "").trimEnd()}…`;
  }
  return lines;
}

/** SVG 1200×630 listo para OG / preview. Sin coords exactas. */
export function shareCardSvg(model: ShareCardModel): string {
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const titleLines = wrapShareHeadline(model.headline);
  const fontSize = titleLines.length >= 3 ? 36 : 40;
  const lineHeight = Math.round(fontSize * 1.22);
  const titleY = 270;
  const titleTspans = titleLines
    .map((line, idx) =>
      idx === 0
        ? `<tspan x="64" y="${titleY}">${esc(line)}</tspan>`
        : `<tspan x="64" dy="${lineHeight}">${esc(line)}</tspan>`,
    )
    .join("");
  const titleBottom = titleY + (titleLines.length - 1) * lineHeight;
  const placeY = titleBottom + 48;
  const place = esc(model.placeLine.slice(0, 48));
  const actionRaw = model.actionLine.trim().slice(0, 80);
  const actionSvg = actionRaw
    ? `<text x="64" y="${placeY + 56}" fill="#1B1A17" font-family="system-ui,sans-serif" font-size="26">${esc(actionRaw)}</text>`
    : "";
  const city = esc(model.cityName);
  const cat = esc(model.categoryLabel);
  const badge = model.cleared
    ? `<rect x="64" y="520" rx="16" width="200" height="44" fill="#1F9D6E"/>
       <text x="164" y="549" text-anchor="middle" fill="#fff" font-family="system-ui,sans-serif" font-size="22" font-weight="700">Ya se despejó</text>`
    : "";

  const mapHint = model.showMapHint
    ? `<circle cx="980" cy="220" r="90" fill="${model.accent}" fill-opacity="0.12"/>
       <circle cx="980" cy="220" r="28" fill="${model.accent}"/>
       <circle cx="980" cy="220" r="10" fill="#F6F2EA"/>`
    : `<text x="980" y="230" text-anchor="middle" fill="#6A6257" font-family="system-ui,sans-serif" font-size="20">Sin mapa en vivo</text>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#F6F2EA"/>
      <stop offset="100%" stop-color="#EFE6D7"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="0" y="0" width="12" height="630" fill="${model.accent}"/>
  <text x="64" y="88" fill="#1B1A17" font-family="system-ui,sans-serif" font-size="28" font-weight="700" letter-spacing="1">PULSO</text>
  <text x="64" y="122" fill="#6A6257" font-family="system-ui,sans-serif" font-size="20">${city}</text>
  <rect x="64" y="160" rx="18" height="40" fill="${model.accent}" fill-opacity="0.14"/>
  <text x="84" y="187" fill="${model.accent}" font-family="system-ui,sans-serif" font-size="20" font-weight="600">${cat}</text>
  <text fill="#1B1A17" font-family="system-ui,sans-serif" font-size="${fontSize}" font-weight="700">${titleTspans}</text>
  <text x="64" y="${placeY}" fill="#6A6257" font-family="system-ui,sans-serif" font-size="24">${place}</text>
  ${actionSvg}
  ${badge}
  ${mapHint}
  <text x="64" y="590" fill="#6A6257" font-family="system-ui,sans-serif" font-size="18">Informar para cuidarse · pulso-ciudadano.com</text>
</svg>`;
}

export function shareCardDataUrl(model: ShareCardModel): string {
  const svg = shareCardSvg(model);
  if (typeof Buffer !== "undefined") {
    return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
  }
  // RN / browser sin Buffer
  const encoded =
    typeof btoa === "function"
      ? btoa(unescape(encodeURIComponent(svg)))
      : "";
  return encoded
    ? `data:image/svg+xml;base64,${encoded}`
    : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function ogImageUrlForPulse(id: string): string {
  return `${APP_SHARE_URL}/api/og?id=${encodeURIComponent(id)}`;
}
