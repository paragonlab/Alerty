import type { PinShape } from "./types";

/** Tamaño del pin en el mapa. La aguja termina en (tipX, height). */
export const SPONSOR_PIN_W = 64;
export const SPONSOR_PIN_H = 78;

export function sponsorPinTipX(shape: PinShape): number {
  return shape === "flag" ? 16 : 32;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function rgb(hexColor: string): [number, number, number] {
  const h = hexColor.replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = Number.parseInt(full, 16);
  if (!Number.isFinite(n) || full.length !== 6) return [217, 85, 43];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("")}`;
}

function mix(hexColor: string, toward: [number, number, number], t: number): string {
  const [r, g, b] = rgb(hexColor);
  return hex(r + (toward[0] - r) * t, g + (toward[1] - g) * t, b + (toward[2] - b) * t);
}

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function needle(id: string, x: number, fromY: number): string {
  const w = 1.7;
  return `
    <ellipse cx="${x + 1.2}" cy="75.6" rx="5" ry="1.6" fill="rgba(0,0,0,0.35)"/>
    <polygon points="${x - w},${fromY} ${x + w},${fromY} ${x + 0.7},71.2 ${x - 0.7},71.2" fill="url(#${id}-metal)"/>
    <polygon points="${x},76.4 ${x - 1.5},70.6 ${x + 1.5},70.6" fill="#c5c9ce"/>
    <polygon points="${x - 0.35},${fromY} ${x + 0.15},${fromY} ${x + 0.05},70" fill="#fff" opacity="0.7"/>
  `;
}

function logo(id: string, url: string, cx: number, cy: number, r: number): string {
  return `
    <clipPath id="${id}-clip"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>
    <image href="${esc(url)}" xlink:href="${esc(url)}" x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" clip-path="url(#${id}-clip)" preserveAspectRatio="xMidYMid slice"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="1.2"/>
  `;
}

/** Alfiler de mapa: plástico con brillo y aguja de metal. La punta es el lugar. */
export function sponsorPinSvg(opts: {
  color: string;
  shape: PinShape;
  logoUrl?: string | null;
}): string {
  const { color, shape } = opts;
  const id = `p${Math.random().toString(36).slice(2, 8)}`;
  const light = mix(color, [255, 255, 255], 0.5);
  const mid = color;
  const dark = mix(color, [28, 16, 12], 0.42);
  const logoUrl = opts.logoUrl && opts.logoUrl.length < 2000 ? opts.logoUrl : null;

  const defs = `
    <linearGradient id="${id}-plastic" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${light}"/>
      <stop offset="0.42" stop-color="${mid}"/>
      <stop offset="1" stop-color="${dark}"/>
    </linearGradient>
    <radialGradient id="${id}-ball" cx="34%" cy="30%" r="68%">
      <stop offset="0" stop-color="${light}"/>
      <stop offset="0.5" stop-color="${mid}"/>
      <stop offset="1" stop-color="${dark}"/>
    </radialGradient>
    <linearGradient id="${id}-metal" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${SPONSOR_PIN_W}" y2="0">
      <stop offset="0" stop-color="#7c828a"/>
      <stop offset="0.38" stop-color="#f7f8f9"/>
      <stop offset="0.62" stop-color="#d5d8dc"/>
      <stop offset="1" stop-color="#5e646c"/>
    </linearGradient>
  `;

  let body = "";
  if (shape === "flag") {
    body = `
      ${needle(id, 16, 14)}
      <path d="M8 10 H56 L42 20 L56 30 H8 Z" fill="${dark}"/>
      <path d="M8 6 H56 L42 16 L56 26 H8 Z" fill="url(#${id}-plastic)" stroke="rgba(255,255,255,0.5)" stroke-width="0.7"/>
      <path d="M10 7.4 H52 L46 12.5 H10 Z" fill="#fff" opacity="0.42"/>
      ${logoUrl ? logo(id, logoUrl, 28, 16, 6.5) : ""}
    `;
  } else if (shape === "house") {
    body = `
      ${needle(id, 32, 50)}
      <polygon points="46,30 54,36 54,54 46,50" fill="${dark}"/>
      <polygon points="32,12 56,32 32,32" fill="${dark}"/>
      <polygon points="12,32 32,12 32,32" fill="${light}"/>
      <rect x="18" y="30" width="28" height="20" rx="1.5" fill="url(#${id}-plastic)"/>
      <path d="M19 31 H45 V34 H19 Z" fill="#fff" opacity="0.28"/>
      ${
        logoUrl
          ? logo(id, logoUrl, 32, 40, 7)
          : `<rect x="28" y="36" width="8" height="9" rx="1" fill="#fff" opacity="0.88"/>
             <rect x="29.2" y="37.2" width="2.6" height="2.6" fill="${light}"/>
             <rect x="32.2" y="37.2" width="2.6" height="2.6" fill="${mid}"/>`
      }
    `;
  } else if (shape === "shield") {
    body = `
      ${needle(id, 32, 56)}
      <path d="M34 10 C34 10 53 16 55 27 L51 47 L34 60 L17 47 L13 27 C15 16 34 10 34 10 Z" fill="${dark}"/>
      <path d="M32 8 C32 8 50 14 52 24 L48 44 L32 56 L16 44 L12 24 C14 14 32 8 32 8 Z" fill="url(#${id}-plastic)" stroke="rgba(255,255,255,0.4)" stroke-width="0.7"/>
      <path d="M32 12 C40 16 46 20 47 26 C40 22 34 18 32 14 C30 18 24 22 17 26 C18 20 24 16 32 12 Z" fill="#fff" opacity="0.32"/>
      ${logoUrl ? logo(id, logoUrl, 32, 32, 8) : ""}
    `;
  } else {
    body = `
      ${needle(id, 32, 34)}
      <ellipse cx="32" cy="35" rx="6" ry="2.2" fill="url(#${id}-metal)"/>
      <circle cx="32" cy="20" r="15" fill="url(#${id}-ball)" stroke="rgba(255,255,255,0.35)" stroke-width="0.8"/>
      ${logoUrl ? logo(id, logoUrl, 32, 20, 9) : ""}
      <ellipse cx="26" cy="14" rx="6" ry="3.2" fill="#fff" opacity="0.72"/>
    `;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SPONSOR_PIN_W} ${SPONSOR_PIN_H}" width="${SPONSOR_PIN_W}" height="${SPONSOR_PIN_H}">
    <defs>${defs}</defs>
    ${body}
  </svg>`;
}
