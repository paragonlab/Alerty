import type { PinGiro, PinShape } from "./types";
import {
  CHARACTER_SVG,
  getCitizenCharacter,
  type CitizenCharacterId,
} from "./characters";
import {
  CATEGORY_BADGE_SVG,
  CATEGORY_MAIN_SVG,
  PIN_CATEGORY_COLORS,
  isPinCategoryId,
  type PinCategoryId,
} from "./categoryIcons";

export type { PinGiro };
export type SponsorZoneType = "refugio" | "anuncio";
export type CommunitySourceKind = "x" | "rss" | "tomtom";

/** Lienzo fuente del globo (pins.py). La punta está en (60, 124). */
const SRC_W = 120;
const SRC_H = 132;
const SRC_TIP_X = 60;
const SRC_TIP_Y = 124;

/** Lienzo con etiqueta de nombre. */
const TAG_SRC_W = 170;
const TAG_SRC_H = 160;
const TAG_PAD_X = (TAG_SRC_W - SRC_W) / 2;

/** Altura en pantalla del globo (~48–52px). */
export const SPONSOR_PIN_H = 50;
export const SPONSOR_PIN_SCALE = SPONSOR_PIN_H / SRC_H;
export const SPONSOR_PIN_W = Math.round(SRC_W * SPONSOR_PIN_SCALE);

export const SPONSOR_NAME_MAX_W = 120;
/** Zoom Leaflet/Google a partir del cual se muestra el nombre. */
export const SPONSOR_NAME_ZOOM_MIN = 14;
/** Equivalente en latitudeDelta (~colonia / calles). */
export const SPONSOR_NAME_MAX_DELTA = 0.025;

const INK = "#1A1A1A";
const SW = 2.7;
const WHITE = "#FFFFFF";
const CREAM = "#FFF4DF";
const YEL = "#FFC83D";
const SKY = "#8FD6FF";
const PINK = "#FF5C7A";
const BROWN = "#7A4A2E";
const ALI = "#D9552B";
const REF = "#1F9D6E";

const S = `stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round" stroke-linecap="round"`;

const NAME_FONT_SIZE = 12.5;
const NAME_CHAR_W = 6.6;

const CX = 60;
const CY = 56;
const R_OUT = 51;
const R_IN = 41;
/** Badge ~22% más grande que el mock (r=14 → ~17). */
const BADGE_R = 17;
const BADGE = { x: 96.5, y: 21 };

export function sponsorPinDisplaySize(showName = false): { w: number; h: number } {
  if (!showName) return { w: SPONSOR_PIN_W, h: SPONSOR_PIN_H };
  return {
    w: Math.round(TAG_SRC_W * SPONSOR_PIN_SCALE),
    h: Math.round(TAG_SRC_H * SPONSOR_PIN_SCALE),
  };
}

export function sponsorPinTipX(showName = false): number {
  return (showName ? TAG_PAD_X + SRC_TIP_X : SRC_TIP_X) * SPONSOR_PIN_SCALE;
}

/** Y del ancla en px de pantalla (igual con o sin etiqueta). */
export function sponsorPinTipY(_showName = false): number {
  return SRC_TIP_Y * SPONSOR_PIN_SCALE;
}

/** Ancla normalizada para react-native-maps Marker. */
export function sponsorPinAnchor(showName = false): { x: number; y: number } {
  const { w, h } = sponsorPinDisplaySize(showName);
  return { x: sponsorPinTipX(showName) / w, y: sponsorPinTipY(showName) / h };
}

export function shouldShowSponsorName(opts: {
  zoom?: number | null;
  latitudeDelta?: number | null;
}): boolean {
  if (typeof opts.zoom === "number" && Number.isFinite(opts.zoom)) {
    return opts.zoom >= SPONSOR_NAME_ZOOM_MIN;
  }
  if (typeof opts.latitudeDelta === "number" && opts.latitudeDelta > 0) {
    return opts.latitudeDelta <= SPONSOR_NAME_MAX_DELTA;
  }
  return false;
}

/** Mapea pin_shape legado → giro. */
export function giroFromPinShape(shape: PinShape, zoneType?: SponsorZoneType): PinGiro {
  if (shape === "flag") return "tienda";
  if (shape === "house") return zoneType === "anuncio" ? "tienda" : "casa";
  if (shape === "shield") return "escudo";
  return zoneType === "refugio" ? "casa" : "generico";
}

export function parsePinGiro(value: unknown): PinGiro | null {
  if (
    value === "tienda" ||
    value === "farmacia" ||
    value === "cafe" ||
    value === "generico" ||
    value === "casa" ||
    value === "escudo"
  ) {
    return value;
  }
  return null;
}

/** Giros ofrecidos según tipo de zona. */
export function girosForZoneType(zoneType: SponsorZoneType): PinGiro[] {
  return zoneType === "refugio"
    ? ["casa", "escudo"]
    : ["tienda", "farmacia", "cafe", "generico"];
}

export function truncateSponsorName(
  name: string,
  maxW = SPONSOR_NAME_MAX_W,
  emptyFallback = "Aliado",
): string {
  const cleaned = name.trim().replace(/\s+/g, " ");
  if (!cleaned) return emptyFallback;
  const maxChars = Math.max(4, Math.floor(maxW / NAME_CHAR_W));
  if (cleaned.length <= maxChars) return cleaned;
  return `${cleaned.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function starPath(cx: number, cy: number, r: number, r2 = r * 0.48, n = 5, rot = -90): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i += 1) {
    const rr = i % 2 === 0 ? r : r2;
    const a = ((rot + (i * 180) / n) * Math.PI) / 180;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join(" L")} Z`;
}

function heartPath(cx: number, cy: number, s: number): string {
  const k = s / 10;
  const p = (x: number, y: number) => `${(cx + x * k).toFixed(2)},${(cy + y * k).toFixed(2)}`;
  return `M${p(0, 8.5)} C${p(-7, 4)} ${p(-10.5, 0.5)} ${p(-10, -3.5)} C${p(-9.5, -8)} ${p(-3.5, -9.5)} ${p(0, -5)} C${p(3.5, -9.5)} ${p(9.5, -8)} ${p(10, -3.5)} C${p(10.5, 0.5)} ${p(7, 4)} ${p(0, 8.5)} Z`;
}

function balloonPath(): string {
  const dx = 16;
  const dy = Math.sqrt(R_OUT ** 2 - dx ** 2);
  const y0 = CY + dy;
  const [tx, ty] = [SRC_TIP_X, SRC_TIP_Y];
  return (
    `M${(CX - dx).toFixed(2)},${y0.toFixed(2)} A${R_OUT},${R_OUT} 0 1 1 ${(CX + dx).toFixed(2)},${y0.toFixed(2)} ` +
    `Q${(CX + 9).toFixed(2)},${(y0 + 5).toFixed(2)} ${(tx + 2.2).toFixed(2)},${(ty - 3.2).toFixed(2)} ` +
    `Q${tx},${ty + 0.6} ${(tx - 2.2).toFixed(2)},${(ty - 3.2).toFixed(2)} ` +
    `Q${(CX - 9).toFixed(2)},${(y0 + 5).toFixed(2)} ${(CX - dx).toFixed(2)},${y0.toFixed(2)} Z`
  );
}

function shadow(): string {
  return `<ellipse cx="60" cy="124.5" rx="12" ry="3.4" fill="#000" fill-opacity="0.28"/>`;
}

/** Tienda simplificada (menos rayas) para que no se ensucie a ~44–50px. */
function icoTienda(): string {
  const aw =
    "M38,36 H82 V45 A7,7 0 0 1 68,45 A7,7 0 0 1 52,45 A7,7 0 0 1 38,45 Z";
  return `
    <clipPath id="awc"><path d="${aw}"/></clipPath>
    <rect x="42" y="44" width="36" height="32" rx="2" fill="${CREAM}" ${S}/>
    <rect x="47" y="55" width="12" height="10" rx="2" fill="${SKY}" ${S}/>
    <rect x="64" y="55" width="10" height="21" rx="2" fill="${SKY}" ${S}/>
    <circle cx="71" cy="66" r="1.3" fill="${INK}"/>
    <g clip-path="url(#awc)">
      <rect x="38" y="32" width="22" height="26" fill="${WHITE}"/>
      <rect x="60" y="32" width="22" height="26" fill="${YEL}"/>
    </g>
    <path d="${aw}" fill="none" ${S}/>`;
}

function icoFarmacia(): string {
  const cross = "M49,31 H63 V44 H76 V58 H63 V71 H49 V58 H36 V44 H49 Z";
  return `
    <path d="${cross}" fill="${WHITE}" ${S}/>
    <g transform="translate(71.5,70) rotate(-40)">
      <clipPath id="capc"><rect x="-15.5" y="-7.5" width="31" height="15" rx="7.5"/></clipPath>
      <g clip-path="url(#capc)">
        <rect x="-16" y="-8" width="16" height="16" fill="${YEL}"/>
        <rect x="0" y="-8" width="16" height="16" fill="${WHITE}"/>
      </g>
      <line x1="0" y1="-7.5" x2="0" y2="7.5" ${S}/>
      <rect x="-15.5" y="-7.5" width="31" height="15" rx="7.5" fill="none" ${S}/>
    </g>`;
}

function icoCafe(): string {
  const cup = "M39,47 H75 L71.5,73 Q70.8,78 65.5,78 H48.5 Q43.2,78 42.5,73 Z";
  const handle = "M73.5,52.5 C85,51 86,67 71,67.5";
  return `
    <path d="M51,40 C47,36 54,33 50,28.5 M62,40 C58,36 65,33 61,28.5" fill="none" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/>
    <ellipse cx="57" cy="79" rx="24" ry="5" fill="${WHITE}" ${S}/>
    <path d="${handle}" fill="none" stroke="${INK}" stroke-width="10" stroke-linecap="round"/>
    <path d="${handle}" fill="none" stroke="${WHITE}" stroke-width="4" stroke-linecap="round"/>
    <path d="${cup}" fill="${WHITE}" ${S}/>
    <clipPath id="cupc"><path d="${cup}"/></clipPath>
    <rect x="38" y="57" width="40" height="7" fill="${YEL}" clip-path="url(#cupc)"/>
    <path d="M40.3,57 H74 M39.5,64 H73" stroke="${INK}" stroke-width="2.2" clip-path="url(#cupc)"/>
    <path d="${cup}" fill="none" ${S}/>
    <ellipse cx="57" cy="47" rx="18" ry="4.2" fill="${BROWN}" ${S}/>`;
}

function icoGenerico(): string {
  const bag = "M40,46 H80 L83.5,79 Q83.8,82 80.8,82 H39.2 Q36.2,82 36.5,79 Z";
  return `
    <path d="M50,50 V41 A10,10 0 0 1 70,41 V50" fill="none" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/>
    <path d="${bag}" fill="${YEL}" ${S}/>
    <circle cx="50" cy="51.5" r="2.2" fill="${INK}"/><circle cx="70" cy="51.5" r="2.2" fill="${INK}"/>
    <path d="${starPath(60, 66.5, 10.5)}" fill="${WHITE}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>`;
}

function icoCasa(): string {
  return `
    <rect x="69" y="30" width="8" height="14" rx="1" fill="${CREAM}" ${S}/>
    <rect x="41" y="49" width="38" height="31" rx="2" fill="${WHITE}" ${S}/>
    <path d="M33,53 L60,31 L87,53" fill="${YEL}" ${S}/>
    <path d="M33,53 L60,31 L87,53 Z" fill="none" ${S}/>
    <path d="${heartPath(60, 66, 8.6)}" fill="${PINK}" ${S}/>`;
}

function icoEscudo(): string {
  const sh =
    "M60,29 C67,34.5 74,36.5 81.5,36.5 C82,59 74,73 60,81 C46,73 38,59 38.5,36.5 C46,36.5 53,34.5 60,29 Z";
  const chk = "M49.5,55.5 L57,63 L71.5,47.5";
  return `
    <path d="${sh}" fill="${WHITE}" ${S}/>
    <path d="${chk}" fill="none" stroke="${INK}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${chk}" fill="none" stroke="${REF}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function giroIcon(giro: PinGiro): string {
  if (giro === "tienda") return icoTienda();
  if (giro === "farmacia") return icoFarmacia();
  if (giro === "cafe") return icoCafe();
  if (giro === "casa") return icoCasa();
  if (giro === "escudo") return icoEscudo();
  return icoGenerico();
}

function badge(kind: SponsorZoneType): string {
  const col = kind === "refugio" ? REF : ALI;
  const { x: bx, y: by } = BADGE;
  const glyph =
    kind === "refugio"
      ? `<path d="${heartPath(bx, by + 0.3, 8.8)}" fill="#fff"/>`
      : `<path d="${starPath(bx, by + 0.6, 10.2, 4.8)}" fill="#fff" stroke-linejoin="round"/>`;
  return `<circle cx="${bx}" cy="${by}" r="${BADGE_R}" fill="${col}" ${S}/>${glyph}`;
}

function nameTag(
  text: string,
  emptyFallback = "Aliado",
  tone: "light" | "dark" = "light",
): string {
  const label = truncateSponsorName(text, SPONSOR_NAME_MAX_W, emptyFallback);
  const tw = Math.min(SPONSOR_NAME_MAX_W, Math.max(36, label.length * NAME_CHAR_W));
  const w = tw + 22;
  const h = 23;
  const cx = TAG_SRC_W / 2;
  const y = 131;
  const fill = tone === "dark" ? INK : WHITE;
  const stroke = tone === "dark" ? INK : INK;
  const fg = tone === "dark" ? WHITE : INK;
  return (
    `<rect x="${(cx - w / 2).toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="${h}" rx="${h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="2.5"/>` +
    `<text x="${cx}" y="${(y + h / 2 + 4.4).toFixed(1)}" text-anchor="middle" font-family="Space Grotesk, system-ui, -apple-system, 'Segoe UI', sans-serif" font-weight="700" font-size="${NAME_FONT_SIZE}" fill="${fg}">${esc(label)}</text>`
  );
}

function resolveGiro(opts: {
  giro?: PinGiro | null;
  shape?: PinShape | null;
  zoneType: SponsorZoneType;
}): PinGiro {
  return opts.giro ?? giroFromPinShape(opts.shape ?? "pin", opts.zoneType);
}

/**
 * Pin Aliado/Refugio estilo Waze.
 * A = sin logo (ilustración por giro). B = con logo + badge de tipo.
 * `showName` pinta la etiqueta debajo de la punta; el ancla sigue siendo la punta.
 */
export function sponsorPinSvg(opts: {
  color?: string;
  zoneType?: SponsorZoneType;
  shape?: PinShape | null;
  giro?: PinGiro | null;
  logoUrl?: string | null;
  name?: string | null;
  showName?: boolean;
}): string {
  const zoneType: SponsorZoneType =
    opts.zoneType ??
    (opts.color && opts.color.toLowerCase() === REF.toLowerCase() ? "refugio" : "anuncio");
  const color = opts.color ?? (zoneType === "refugio" ? REF : ALI);
  const logoUrl = opts.logoUrl && opts.logoUrl.length < 2000 ? opts.logoUrl : null;
  const showName = Boolean(opts.showName);
  const giro = resolveGiro({ giro: opts.giro, shape: opts.shape, zoneType });
  const id = `p${Math.random().toString(36).slice(2, 8)}`;

  let inner: string;
  if (logoUrl) {
    inner = `
      <clipPath id="${id}-lg"><circle cx="${CX}" cy="${CY}" r="${R_IN}"/></clipPath>
      <g clip-path="url(#${id}-lg)">
        <image href="${esc(logoUrl)}" xlink:href="${esc(logoUrl)}" x="${CX - R_IN}" y="${CY - R_IN}" width="${R_IN * 2}" height="${R_IN * 2}" preserveAspectRatio="xMidYMid slice"/>
      </g>
      ${badge(zoneType)}`;
  } else {
    inner = giroIcon(giro);
  }

  const fillCircle = logoUrl ? WHITE : color;
  const balloon = `
    ${shadow()}
    <path d="${balloonPath()}" fill="${WHITE}" ${S}/>
    <circle cx="${CX}" cy="${CY}" r="${R_IN}" fill="${fillCircle}"/>
    ${inner}`;

  const vbW = showName ? TAG_SRC_W : SRC_W;
  const vbH = showName ? TAG_SRC_H : SRC_H;
  const { w: outW, h: outH } = sponsorPinDisplaySize(showName);
  const body = showName
    ? `<g transform="translate(${TAG_PAD_X},0)">${balloon}</g>${nameTag(opts.name ?? "")}`
    : balloon;

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${vbW} ${vbH}" width="${outW}" height="${outH}">
  <defs></defs>
  ${body}
</svg>`;
}

function categoryBadge(cat: PinCategoryId): string {
  const col = PIN_CATEGORY_COLORS[cat];
  const { x: bx, y: by } = BADGE;
  const k = BADGE_R / 37;
  const id = `bdg${Math.random().toString(36).slice(2, 8)}`;
  const glyph = CATEGORY_BADGE_SVG[cat] ?? CATEGORY_MAIN_SVG[cat] ?? "";
  return (
    `<circle cx="${bx}" cy="${by}" r="${BADGE_R}" fill="${col}"/>` +
    `<clipPath id="${id}"><circle cx="${bx}" cy="${by}" r="${BADGE_R - SW / 2}"/></clipPath>` +
    `<g clip-path="url(#${id})"><g transform="translate(${bx},${by + 0.5}) scale(${k.toFixed(4)})">${glyph}</g></g>` +
    `<circle cx="${bx}" cy="${by}" r="${BADGE_R}" fill="none" stroke="${INK}" stroke-width="${SW}"/>`
  );
}

function sourceChip(kind: CommunitySourceKind): string {
  const { x: bx, y: by } = BADGE;
  const r = BADGE_R;
  const base = `<circle cx="${bx}" cy="${by}" r="${r}" fill="${WHITE}" ${S}/>`;
  if (kind === "rss") {
    return (
      base +
      `<path d="M${bx - 8},${by - 7} H${bx + 5} L${bx + 8},${by - 4} V${by + 7} H${bx - 8} Z" fill="${WHITE}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>` +
      `<path d="M${bx - 5},${by - 2.5} H${bx + 5} M${bx - 5},${by + 1} H${bx + 5} M${bx - 5},${by + 4.3} H${bx + 2}" stroke="${INK}" stroke-width="1.7" stroke-linecap="round"/>`
    );
  }
  if (kind === "tomtom") {
    // Chip de circulación (trazo de vía) — distinto de X/RSS.
    return (
      base +
      `<path d="M${bx - 7},${by + 6} L${bx - 2},${by - 7} H${bx + 2} L${bx + 7},${by + 6} Z" fill="none" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>` +
      `<path d="M${bx},${by - 4} V${by + 3}" stroke="${INK}" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="2.2 2"/>`
    );
  }
  return (
    base +
    `<path d="M${bx - 9},${by - 5} Q${bx - 9},${by - 9} ${bx - 5},${by - 9} H${bx + 5} Q${bx + 9},${by - 9} ${bx + 9},${by - 5} V${by + 1} Q${bx + 9},${by + 5} ${bx + 5},${by + 5} H${bx - 1} L${bx - 6},${by + 9} V${by + 5} Q${bx - 9},${by + 5} ${bx - 9},${by + 1} Z" fill="${INK}"/>` +
    `<circle cx="${bx - 4}" cy="${by - 2}" r="1.5" fill="${WHITE}"/><circle cx="${bx}" cy="${by - 2}" r="1.5" fill="${WHITE}"/><circle cx="${bx + 4}" cy="${by - 2}" r="1.5" fill="${WHITE}"/>`
  );
}

function countChip(n: number): string {
  const bx = 24;
  const by = 22;
  const r = 15;
  const label = `+${Math.max(1, Math.floor(n))}`;
  return (
    `<circle cx="${bx}" cy="${by}" r="${r}" fill="${INK}" stroke="${WHITE}" stroke-width="2.4"/>` +
    `<text x="${bx}" y="${by + 5.2}" text-anchor="middle" font-family="Space Grotesk, system-ui, -apple-system, 'Segoe UI', sans-serif" font-weight="800" font-size="14.5" fill="${WHITE}">${esc(label)}</text>`
  );
}

function wrapBalloonSvg(
  balloonInner: string,
  showName: boolean,
  name?: string | null,
  emptyNameFallback = "Pulso",
  nameTone: "light" | "dark" = "dark",
): string {
  const balloon = `${shadow()}
    <path d="${balloonPath()}" fill="${WHITE}" ${S}/>
    ${balloonInner}`;
  const vbW = showName ? TAG_SRC_W : SRC_W;
  const vbH = showName ? TAG_SRC_H : SRC_H;
  const { w: outW, h: outH } = sponsorPinDisplaySize(showName);
  const body = showName
    ? `<g transform="translate(${TAG_PAD_X},0)">${balloon}</g>${nameTag(name ?? "", emptyNameFallback, nameTone)}`
    : balloon;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${vbW} ${vbH}" width="${outW}" height="${outH}">
  <defs></defs>
  ${body}
</svg>`;
}

/**
 * Pin ciudadano estilo Waze.
 * A = personaje. B = personaje + insignia de categoría. C = foto + insignia (fallback a personaje).
 */
export function citizenPinSvg(opts: {
  characterId: CitizenCharacterId;
  category?: string | null;
  photoUrl?: string | null;
  name?: string | null;
  showName?: boolean;
  showBadge?: boolean;
}): string {
  const showName = Boolean(opts.showName);
  const showBadge = opts.showBadge !== false && Boolean(opts.category);
  const photoUrl = opts.photoUrl && opts.photoUrl.length < 2000 ? opts.photoUrl : null;
  const char = getCitizenCharacter(opts.characterId);
  const id = `c${Math.random().toString(36).slice(2, 8)}`;
  const cat = opts.category && isPinCategoryId(opts.category) ? opts.category : null;

  let face: string;
  if (photoUrl) {
    face = `
      <clipPath id="${id}-ph"><circle cx="${CX}" cy="${CY}" r="${R_IN}"/></clipPath>
      <circle cx="${CX}" cy="${CY}" r="${R_IN}" fill="#ccc"/>
      <g clip-path="url(#${id}-ph)">
        <image href="${esc(photoUrl)}" xlink:href="${esc(photoUrl)}" x="${CX - R_IN}" y="${CY - R_IN}" width="${R_IN * 2}" height="${R_IN * 2}" preserveAspectRatio="xMidYMid slice"/>
      </g>`;
  } else {
    face = `
      <clipPath id="${id}-ch"><circle cx="${CX}" cy="${CY}" r="${R_IN}"/></clipPath>
      <circle cx="${CX}" cy="${CY}" r="${R_IN}" fill="${char.bg}"/>
      <g clip-path="url(#${id}-ch)">${CHARACTER_SVG[opts.characterId]}</g>`;
  }

  const badge = showBadge && cat ? categoryBadge(cat) : "";
  return wrapBalloonSvg(`${face}${badge}`, showName, opts.name, "Vecino");
}

/**
 * Pin Pulso (community_posts) estilo Waze.
 * A = logo + aro de categoría + insignia. B = ícono de categoría + chip de fuente.
 * C = A + contador +N (fuentes adicionales).
 */
export function pulsoPinSvg(opts: {
  category?: string | null;
  logoUrl?: string | null;
  source?: CommunitySourceKind | null;
  extraSources?: number;
  name?: string | null;
  showName?: boolean;
}): string {
  const showName = Boolean(opts.showName);
  const logoUrl = opts.logoUrl && opts.logoUrl.length < 2000 ? opts.logoUrl : null;
  const cat: PinCategoryId =
    opts.category && isPinCategoryId(opts.category) ? opts.category : "alerta";
  const color = PIN_CATEGORY_COLORS[cat];
  const id = `u${Math.random().toString(36).slice(2, 8)}`;
  const extras = Math.max(0, Math.floor(opts.extraSources ?? 0));

  let inner: string;
  if (logoUrl) {
    const rLogo = R_IN - 5;
    inner = `
      <circle cx="${CX}" cy="${CY}" r="${R_IN}" fill="${color}"/>
      <clipPath id="${id}-lg"><circle cx="${CX}" cy="${CY}" r="${rLogo}"/></clipPath>
      <g clip-path="url(#${id}-lg)">
        <image href="${esc(logoUrl)}" xlink:href="${esc(logoUrl)}" x="${CX - rLogo}" y="${CY - rLogo}" width="${rLogo * 2}" height="${rLogo * 2}" preserveAspectRatio="xMidYMid slice"/>
      </g>
      <circle cx="${CX}" cy="${CY}" r="${rLogo}" fill="none" stroke="${WHITE}" stroke-width="1.6"/>
      ${categoryBadge(cat)}
      ${extras > 0 ? countChip(extras) : ""}`;
  } else {
    const main = CATEGORY_MAIN_SVG[cat] ?? "";
    inner = `
      <circle cx="${CX}" cy="${CY}" r="${R_IN}" fill="${color}"/>
      <g transform="translate(${CX},${CY})">${main}</g>
      ${opts.source ? sourceChip(opts.source) : ""}
      ${extras > 0 ? countChip(extras) : ""}`;
  }

  return wrapBalloonSvg(inner, showName, opts.name);
}

/** Alias de tamaño/ancla compartido por las tres familias de globo. */
export const balloonPinDisplaySize = sponsorPinDisplaySize;
export const balloonPinTipX = sponsorPinTipX;
export const balloonPinTipY = sponsorPinTipY;
export const balloonPinAnchor = sponsorPinAnchor;
export const shouldShowPinName = shouldShowSponsorName;
