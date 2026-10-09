/**
 * Smoke: SVG → PNG con Noto Sans embebido + texto visible (píxeles oscuros).
 * Run: node api/og.png.test.mjs
 */
import { createRequire } from "module";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const require = createRequire(import.meta.url);
const {
  svgFor,
  svgShapesOnly,
  renderPng,
  renderImage,
  countDarkPixels,
  cleanShareTitle,
  FONT_REGULAR,
  FONT_BOLD,
} = require("./_pulseShared.js");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(existsSync(FONT_REGULAR), `falta ${FONT_REGULAR}`);
assert(existsSync(FONT_BOLD), `falta ${FONT_BOLD}`);

const alertModel = {
  category: "bloqueo",
  title: "Tráfico lento en Boulevares",
  place: "Boulevares",
  cityName: "Culiacán",
  status: "active",
  showMap: true,
};

const communityRaw =
  "🏠🚨 PROYECTAN 37 MIL VIVIENDAS DEL BIENESTAR PARA Sinaloa\nhttps://t.co/abc123XYZ más info";

const communityModel = {
  category: "alerta",
  title: communityRaw,
  place: "Culiacán",
  cityName: "Culiacán",
  status: "active",
  showMap: true,
};

const cleaned = cleanShareTitle(communityRaw, "Aviso", 80);
assert(!/t\.co|https?:/i.test(cleaned), `sin links: ${cleaned}`);
assert(!cleaned.includes("🏠") && !cleaned.includes("🚨"), `sin emojis: ${cleaned}`);
assert(!/\n/.test(cleaned), "sin saltos");
assert(cleaned.length <= 81, `max ~80: ${cleaned.length} «${cleaned}»`);
assert(/Sinaloa|Viviendas|Proyectan/i.test(cleaned), `contenido útil: ${cleaned}`);
assert(cleaned !== cleaned.toUpperCase(), `no ALL CAPS: ${cleaned}`);

const withText = renderImage(svgFor(alertModel), { withFonts: true });
const shapesOnly = renderImage(svgShapesOnly(alertModel), { withFonts: true });
const darkWith = countDarkPixels(withText);
const darkShapes = countDarkPixels(shapesOnly);

assert(
  darkWith > darkShapes * 3 + 80,
  `texto debe pintar tinta en la zona del título (con=${darkWith}, formas=${darkShapes})`,
);

// Sin fuentes: resvg no pinta glyphs → poca tinta (simula el bug de prod).
const noFont = renderImage(svgFor(alertModel), { withFonts: false });
const darkNoFont = countDarkPixels(noFont);
assert(
  darkWith > darkNoFont * 3 + 80,
  `con TTF debe haber mucho más texto que sin fuentes (con=${darkWith}, sin=${darkNoFont})`,
);

const outDir = "/opt/cursor/artifacts";
mkdirSync(outDir, { recursive: true });

const alertPng = withText.asPng();
assert(alertPng[0] === 0x89 && alertPng[1] === 0x50, "PNG magic");
writeFileSync(join(outDir, "og-alert-with-text.png"), alertPng);

const communityRendered = renderImage(svgFor(communityModel), { withFonts: true });
const communityDark = countDarkPixels(communityRendered);
assert(communityDark > 100, `community OG con texto (${communityDark} px)`);
writeFileSync(join(outDir, "og-community-with-text.png"), communityRendered.asPng());

// Sanity: renderPng sigue exportando buffer
const viaHelper = renderPng(svgFor(alertModel));
assert(viaHelper && viaHelper.length > 5000, "renderPng size");

console.log("og.png.test.mjs OK", {
  darkWith,
  darkShapes,
  darkNoFont,
  cleaned,
  communityDark,
  alertBytes: alertPng.length,
});
