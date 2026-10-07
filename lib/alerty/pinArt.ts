import type { PinShape } from "./types";

/**
 * Etiqueta de negocio: chip blanco con icono, nombre, cola y punto de suelo.
 * El ancla del mapa es el centro del punto de suelo (abajo al centro).
 */
export const SPONSOR_PIN_W = 152;
export const SPONSOR_PIN_H = 52;

/** Ancho máximo del texto del nombre (px SVG). Más largo → ellipsis. */
export const SPONSOR_NAME_MAX_W = 108;

const NAME_FONT_SIZE = 12;
/** Ancho medio aproximado de Space Grotesk Bold a 12px. */
const NAME_CHAR_W = 6.5;

export function sponsorPinTipX(_shape?: PinShape): number {
  return SPONSOR_PIN_W / 2;
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Trunca el nombre para que quepa en el chip con ellipsis. */
export function truncateSponsorName(name: string, maxW = SPONSOR_NAME_MAX_W): string {
  const cleaned = name.trim().replace(/\s+/g, " ");
  if (!cleaned) return "Aliado";
  const maxChars = Math.max(4, Math.floor(maxW / NAME_CHAR_W));
  if (cleaned.length <= maxChars) return cleaned;
  return `${cleaned.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
}

function estimateTextWidth(label: string): number {
  return Math.min(SPONSOR_NAME_MAX_W, Math.max(28, label.length * NAME_CHAR_W));
}

function shapeGlyph(shape: PinShape, color: string): string {
  if (shape === "flag") {
    return `
      <rect x="6" y="4" width="2.2" height="15" rx="1.1" fill="#fff"/>
      <path d="M8.2 5.2 H17.5 L15.8 8.6 L17.5 12 H8.2 Z" fill="#fff"/>
    `;
  }
  if (shape === "house") {
    return `
      <path d="M4.5 10.5 L11 5.2 L17.5 10.5 V17 H13.2 V13.2 H8.8 V17 H4.5 Z" fill="#fff"/>
    `;
  }
  if (shape === "shield") {
    return `
      <path d="M11 3.8 C13.2 5.2 15.4 5.6 17.2 5.6 C17.7 5.6 18 5.9 18 6.3 C17.7 12.2 15.2 15.8 11.4 18.2 C11.15 18.35 10.85 18.35 10.6 18.2 C6.8 15.8 4.3 12.2 4 6.3 C4 5.9 4.3 5.6 4.8 5.6 C6.6 5.6 8.8 5.2 11 3.8 Z" fill="#fff"/>
      <path d="M8.2 11.1 L10.2 13.1 L14.2 8.8" fill="none" stroke="${esc(color)}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    `;
  }
  return `
    <path d="M11 18.2 C10.2 16.8 5.8 12.4 5.8 8.6 A5.2 5.2 0 0 1 16.2 8.6 C16.2 12.4 11.8 16.8 11 18.2 Z" fill="#fff"/>
    <circle cx="11" cy="8.5" r="2.1" fill="${esc(color)}"/>
  `;
}

/**
 * Pin de Aliado / Refugio: etiqueta plana legible en mapas claros y oscuros.
 * La punta (punto de suelo) es el lugar.
 */
export function sponsorPinSvg(opts: {
  color: string;
  shape: PinShape;
  logoUrl?: string | null;
  name?: string | null;
}): string {
  const { color, shape } = opts;
  const logoUrl = opts.logoUrl && opts.logoUrl.length < 2000 ? opts.logoUrl : null;
  const id = logoUrl ? `p${Math.random().toString(36).slice(2, 8)}` : "";
  const label = truncateSponsorName(opts.name ?? "");

  const chipH = 32;
  const chipY = 4;
  const iconPad = 5;
  const iconSize = 22;
  const textGap = 8;
  const textW = estimateTextWidth(label);
  const chipW = Math.min(
    SPONSOR_PIN_W - 8,
    iconPad + iconSize + textGap + textW + iconPad,
  );
  const chipX = (SPONSOR_PIN_W - chipW) / 2;
  const iconX = chipX + iconPad;
  const iconY = chipY + (chipH - iconSize) / 2;
  const textX = iconX + iconSize + textGap;
  const tipX = SPONSOR_PIN_W / 2;
  const chipBottom = chipY + chipH;
  const tailTop = chipBottom - 1;
  const tailH = 7;
  const tailHalf = 6;
  const dotCy = SPONSOR_PIN_H - 5;
  const dotR = 4.5;

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${SPONSOR_PIN_W} ${SPONSOR_PIN_H}" width="${SPONSOR_PIN_W}" height="${SPONSOR_PIN_H}">
  <defs>
    ${logoUrl ? `<clipPath id="${id}-logo"><rect x="${iconX}" y="${iconY}" width="${iconSize}" height="${iconSize}" rx="6"/></clipPath>` : ""}
  </defs>
  <ellipse cx="${tipX}" cy="${chipBottom + 3}" rx="${Math.max(18, chipW * 0.38)}" ry="3.2" fill="rgba(0,0,0,0.18)"/>
  <path d="M${tipX - tailHalf} ${tailTop} L${tipX} ${tailTop + tailH} L${tipX + tailHalf} ${tailTop} Z" fill="${esc(color)}"/>
  <rect x="${chipX}" y="${chipY}" width="${chipW}" height="${chipH}" rx="10" ry="10" fill="#ffffff" stroke="${esc(color)}" stroke-width="2"/>
  <rect x="${iconX}" y="${iconY}" width="${iconSize}" height="${iconSize}" rx="6" ry="6" fill="${esc(color)}"/>
  ${
    logoUrl
      ? `<image href="${esc(logoUrl)}" xlink:href="${esc(logoUrl)}" x="${iconX}" y="${iconY}" width="${iconSize}" height="${iconSize}" clip-path="url(#${id}-logo)" preserveAspectRatio="xMidYMid slice"/>`
      : `<g transform="translate(${iconX}, ${iconY})">${shapeGlyph(shape, color)}</g>`
  }
  <text x="${textX}" y="${chipY + chipH / 2 + 1}" fill="#1B1A17" font-size="${NAME_FONT_SIZE}" font-weight="700" font-family="Space Grotesk, system-ui, -apple-system, 'Segoe UI', sans-serif" dominant-baseline="middle">${esc(label)}</text>
  <circle cx="${tipX}" cy="${dotCy}" r="${dotR}" fill="${esc(color)}" stroke="#ffffff" stroke-width="1.8"/>
</svg>`;
}
