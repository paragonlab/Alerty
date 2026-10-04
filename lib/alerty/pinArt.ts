import type { PinShape } from "./types";

/** Tamaño del pin en el mapa. La punta toca el suelo en (tipX, height). */
export const SPONSOR_PIN_W = 64;
export const SPONSOR_PIN_H = 76;

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

const DEPTH = 4;

/** Pieza de plastilina: canto oscuro debajo, cara con volumen y brillo suave. */
function clay(d: string, face: string, edge: string): string {
  return `
    <path d="${d}" fill="${edge}" transform="translate(0 ${DEPTH})"/>
    <path d="${d}" fill="${edge}" transform="translate(0 ${DEPTH / 2})"/>
    <path d="${d}" fill="${face}"/>
  `;
}

function shadow(cx: number, rx: number): string {
  return `<ellipse cx="${cx}" cy="73" rx="${rx}" ry="2.6" fill="rgba(0,0,0,0.22)"/>`;
}

function logo(id: string, url: string, cx: number, cy: number, r: number): string {
  return `
    <circle cx="${cx}" cy="${cy + 1.2}" r="${r + 1.6}" fill="rgba(0,0,0,0.18)"/>
    <circle cx="${cx}" cy="${cy}" r="${r + 1.6}" fill="#fff"/>
    <clipPath id="${id}-clip"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>
    <image href="${esc(url)}" xlink:href="${esc(url)}" x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" clip-path="url(#${id}-clip)" preserveAspectRatio="xMidYMid slice"/>
  `;
}

/** Pin de Aliado con look 3D tipo plastilina. La punta es el lugar. */
export function sponsorPinSvg(opts: {
  color: string;
  shape: PinShape;
  logoUrl?: string | null;
}): string {
  const { color, shape } = opts;
  const id = `p${Math.random().toString(36).slice(2, 8)}`;
  const light = mix(color, [255, 255, 255], 0.38);
  const dark = mix(color, [30, 18, 14], 0.38);
  const logoUrl = opts.logoUrl && opts.logoUrl.length < 2000 ? opts.logoUrl : null;
  const face = `url(#${id}-face)`;
  const gloss = `url(#${id}-gloss)`;

  const defs = `
    <radialGradient id="${id}-face" cx="38%" cy="28%" r="80%">
      <stop offset="0" stop-color="${light}"/>
      <stop offset="0.55" stop-color="${color}"/>
      <stop offset="1" stop-color="${mix(color, [30, 18, 14], 0.18)}"/>
    </radialGradient>
    <radialGradient id="${id}-gloss" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#fff" stop-opacity="0.75"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="${id}-cream" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fffdf8"/>
      <stop offset="1" stop-color="#e3d7c4"/>
    </linearGradient>
  `;

  let body: string;
  if (shape === "flag") {
    const cloth = "M19 9 C30 4 40 13 56 8 C58 8 59 10 58 12 L52 21 L58 30 C59 32 58 34 56 34 C40 38 30 29 19 34 Z";
    body = `
      ${shadow(17, 9)}
      <ellipse cx="16" cy="70" rx="8.5" ry="3.6" fill="${dark}"/>
      <ellipse cx="16" cy="68" rx="8.5" ry="3.6" fill="${color}"/>
      <ellipse cx="14" cy="67" rx="4" ry="1.4" fill="#fff" opacity="0.35"/>
      <rect x="13" y="7" width="6" height="61" rx="3" fill="url(#${id}-cream)"/>
      ${clay(cloth, face, dark)}
      <ellipse cx="32" cy="12" rx="11" ry="3.2" fill="${gloss}"/>
      ${logoUrl ? logo(id, logoUrl, 36, 21, 7) : ""}
      <circle cx="16" cy="7" r="5" fill="${dark}" transform="translate(0 1.5)"/>
      <circle cx="16" cy="7" r="5" fill="url(#${id}-cream)"/>
      <circle cx="14.4" cy="5.4" r="1.6" fill="#fff" opacity="0.9"/>
    `;
  } else if (shape === "house") {
    const roof = "M8 33 L29 13 C30.8 11.3 33.2 11.3 35 13 L56 33 C57.6 34.6 56.5 37 54.3 37 H9.7 C7.5 37 6.4 34.6 8 33 Z";
    const walls = "M15 34 H49 V56 C49 58.2 47.2 60 45 60 H38 L32 69 L26 60 H19 C16.8 60 15 58.2 15 56 Z";
    body = `
      ${shadow(32, 9)}
      ${clay(walls, `url(#${id}-cream)`, "#cbbba3")}
      ${clay(roof, face, dark)}
      <ellipse cx="30" cy="22" rx="9" ry="3.2" fill="${gloss}"/>
      ${
        logoUrl
          ? logo(id, logoUrl, 32, 47, 7.5)
          : `<rect x="27" y="44" width="10" height="13" rx="4" fill="${dark}" transform="translate(0 1.2)"/>
             <rect x="27" y="44" width="10" height="13" rx="4" fill="${color}"/>
             <circle cx="34.5" cy="51" r="1" fill="#fff" opacity="0.85"/>`
      }
    `;
  } else if (shape === "shield") {
    const d = "M32 6 C40 11 47 12.5 53 12.5 C55 12.5 56 14 56 16 C55 41 46 56 33.5 66.5 C32.6 67.3 31.4 67.3 30.5 66.5 C18 56 9 41 8 16 C8 14 9 12.5 11 12.5 C17 12.5 24 11 32 6 Z";
    body = `
      ${shadow(32, 9)}
      ${clay(d, face, dark)}
      <ellipse cx="26" cy="20" rx="10" ry="4.5" fill="${gloss}"/>
      ${
        logoUrl
          ? logo(id, logoUrl, 32, 33, 9.5)
          : `<path d="M22 33 L29 40 L43 25" fill="none" stroke="${dark}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 1.6)"/>
             <path d="M22 33 L29 40 L43 25" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`
      }
    `;
  } else {
    const d = "M32 68 C29 63 13 47 13 27 A19 19 0 0 1 51 27 C51 47 35 63 32 68 Z";
    body = `
      ${shadow(32, 8)}
      ${clay(d, face, dark)}
      <ellipse cx="25" cy="16" rx="8" ry="4.5" fill="${gloss}"/>
      ${
        logoUrl
          ? logo(id, logoUrl, 32, 27, 10)
          : `<circle cx="32" cy="28.4" r="8.5" fill="${dark}"/>
             <circle cx="32" cy="27" r="8.5" fill="#fff"/>
             <circle cx="30" cy="25" r="2.6" fill="#fff" opacity="0.9"/>`
      }
    `;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${SPONSOR_PIN_W} ${SPONSOR_PIN_H}" width="${SPONSOR_PIN_W}" height="${SPONSOR_PIN_H}">
    <defs>${defs}</defs>
    ${body}
  </svg>`;
}
