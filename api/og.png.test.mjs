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
  fitHeadline,
  actionLineFor,
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

const longCommunityRaw =
  "URGENTE: ANUNCIAN AMPLIACIÓN DE OBRAS DEL PROGRAMA DEL BIENESTAR EN VARIAS COLONIAS DE Culiacán Y Mazatlán CON ENTREGA GRADUAL DE VIVIENDAS https://t.co/xyz999 más detalles en el enlace";

const cleaned = cleanShareTitle(communityRaw, "Aviso", 100);
assert(!/t\.co|https?:/i.test(cleaned), `sin links: ${cleaned}`);
assert(!cleaned.includes("🏠") && !cleaned.includes("🚨"), `sin emojis: ${cleaned}`);
assert(!/\n/.test(cleaned), "sin saltos");
assert(cleaned.startsWith("Proyectan"), `oración: ${cleaned}`);
assert(/\bmil\b/.test(cleaned) && /\bviviendas\b/.test(cleaned), `sentence case: ${cleaned}`);
assert(cleaned.includes("Sinaloa") && cleaned.includes("Bienestar"), `gazetteer: ${cleaned}`);
assert(cleaned !== cleaned.toUpperCase(), `no ALL CAPS: ${cleaned}`);

const withHash = cleanShareTitle(
  "URGENTE: OBRAS DEL BIENESTAR EN #Sinaloa @NoticiasMX",
  "Aviso",
  100,
);
assert(!withHash.includes("#") && !withHash.includes("@"), `sin #/@: ${withHash}`);
assert(withHash.includes("Sinaloa"), `conserva Sinaloa: ${withHash}`);

assert(actionLineFor("alerta") === "", "community alerta sin action");
assert(actionLineFor("bloqueo").length > 0, "bloqueo sí tiene action");

const wrapped = fitHeadline(cleaned);
assert(wrapped.lines.length >= 1 && wrapped.lines.length <= 3, `wrap 1–3: ${wrapped.lines.length}`);
assert(
  wrapped.lines.every((l) => l.length <= 50),
  `líneas acotadas: ${JSON.stringify(wrapped.lines)}`,
);

const longClean = cleanShareTitle(longCommunityRaw, "Aviso", 140);
const longWrap = fitHeadline(longClean);
assert(longWrap.lines.length <= 3, `largo ≤3 líneas: ${longWrap.lines.length}`);
assert(
  longWrap.truncated || longWrap.lines.join(" ").length <= longClean.length,
  "largo trunca o cabe",
);
assert(longWrap.lines[longWrap.lines.length - 1].includes("…") || !longWrap.truncated, "… si truncado");

const shortWrap = fitHeadline("Choque menor en Centro");
assert(shortWrap.lines.length === 1, "corto en 1 línea");
assert(shortWrap.fontSize === 40, "corto usa fuente grande");

const withText = renderImage(svgFor(alertModel), { withFonts: true });
const shapesOnly = renderImage(svgShapesOnly(alertModel), { withFonts: true });
const darkWith = countDarkPixels(withText);
const darkShapes = countDarkPixels(shapesOnly);

assert(
  darkWith > darkShapes * 3 + 80,
  `texto debe pintar tinta en la zona del título (con=${darkWith}, formas=${darkShapes})`,
);

const noFont = renderImage(svgFor(alertModel), { withFonts: false });
const darkNoFont = countDarkPixels(noFont);
assert(
  darkWith > darkNoFont * 3 + 80,
  `con TTF debe haber mucho más texto que sin fuentes (con=${darkWith}, sin=${darkNoFont})`,
);

const alertSvg = svgFor(alertModel);
assert(alertSvg.includes("tspan"), "alerta usa wrap/tspan");
assert(alertSvg.includes("Mejor rodea"), "alerta riesgo muestra action");
assert(!alertSvg.includes("Échale un ojo"), "sin copy viejo de alerta");

const communitySvg = svgFor(communityModel);
assert(communitySvg.includes("tspan"), "community wrap");
assert((communitySvg.match(/<tspan/g) || []).length >= 2, "community ≥2 líneas");
assert(!communitySvg.includes("Échale un ojo"), "community sin action alarmista");
assert(!/y="${270 + 56}"|decide con calma/i.test(communitySvg), "sin línea de acción info");

const outDir = "/opt/cursor/artifacts";
mkdirSync(outDir, { recursive: true });

const alertPng = withText.asPng();
assert(alertPng[0] === 0x89 && alertPng[1] === 0x50, "PNG magic");
writeFileSync(join(outDir, "og-alert-with-text.png"), alertPng);

const communityRendered = renderImage(svgFor(communityModel), { withFonts: true });
const communityDark = countDarkPixels(communityRendered);
assert(communityDark > 100, `community OG con texto (${communityDark} px)`);
writeFileSync(join(outDir, "og-community-with-text.png"), communityRendered.asPng());

const longModel = {
  ...communityModel,
  title: longCommunityRaw,
};
writeFileSync(
  join(outDir, "og-community-long-with-text.png"),
  renderImage(svgFor(longModel), { withFonts: true }).asPng(),
);

const shortModel = {
  category: "accidente",
  title: "Choque menor en Centro",
  place: "Centro",
  cityName: "Mazatlán",
  status: "active",
  showMap: true,
};
writeFileSync(
  join(outDir, "og-alert-short-with-text.png"),
  renderImage(svgFor(shortModel), { withFonts: true }).asPng(),
);

const viaHelper = renderPng(svgFor(alertModel));
assert(viaHelper && viaHelper.length > 5000, "renderPng size");

/** 8×8 PNG sólido (naranja) para probar miniatura embutida en OG video. */
const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAFElEQVQYV2P8z8Dwn4EIwDiqIFQAAKUAAf8p9aSFAAAAAElFTkSuQmCC";

const videoModel = {
  category: "bloqueo",
  title: "Tráfico lento en Boulevares",
  place: "Boulevares",
  cityName: "Culiacán",
  status: "active",
  showMap: true,
  surface: "video",
  thumbDataUri: TINY_PNG,
};
const videoSvg = svgFor(videoModel);
assert(videoSvg.includes("Video"), "OG video badge");
assert(videoSvg.includes("<image"), "OG video embute miniatura");
assert(!videoSvg.includes("24.809"), "video OG sin coords");
const videoPng = renderImage(videoSvg, { withFonts: true }).asPng();
assert(videoPng[0] === 0x89, "video OG PNG magic");
writeFileSync(join(outDir, "og-video-with-thumb.png"), videoPng);

const videoFallback = svgFor({
  ...alertModel,
  surface: "video",
  thumbDataUri: null,
});
assert(videoFallback.includes("Video en Pulso") || videoFallback.includes("Video"), "fallback video");

console.log("og.png.test.mjs OK", {
  darkWith,
  darkShapes,
  darkNoFont,
  cleaned,
  wrapLines: wrapped.lines,
  longLines: longWrap.lines,
  communityDark,
  alertBytes: alertPng.length,
});
