/**
 * Smoke: SVG → PNG con resvg (misma ruta que /api/og).
 * Run: node api/og.png.test.mjs
 */
import { createRequire } from "module";
import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const { svgFor, renderPng } = require("./_pulseShared.js");

const svg = svgFor({
  category: "bloqueo",
  title: "Tráfico lento en Boulevares",
  place: "Boulevares",
  cityName: "Culiacán",
  status: "active",
  showMap: true,
});

const png = renderPng(svg);
if (!png || png.length < 1000) {
  console.error("PNG render failed or too small", png && png.length);
  process.exit(1);
}
// PNG magic
if (png[0] !== 0x89 || png[1] !== 0x50) {
  console.error("not a PNG");
  process.exit(1);
}

const outDir = "/opt/cursor/artifacts";
mkdirSync(outDir, { recursive: true });
const out = join(outDir, "og-preview-png.png");
writeFileSync(out, png);
console.log("og.png.test.mjs OK →", out, png.length, "bytes");

const communitySvg = svgFor({
  category: "alerta",
  title: "Vecinos reportan movimiento en La Obregón",
  place: "La Obregón",
  cityName: "Culiacán",
  status: "active",
  showMap: true,
});
const communityPng = renderPng(communitySvg);
if (!communityPng) {
  console.error("community PNG failed");
  process.exit(1);
}
writeFileSync(join(outDir, "og-community-pulse-png.png"), communityPng);
console.log("community OG OK");

void dirname(fileURLToPath(import.meta.url));
