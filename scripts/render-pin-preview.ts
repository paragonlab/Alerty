import { writeFileSync, mkdirSync } from "fs";
import { citizenPinSvg, pulsoPinSvg, sponsorPinSvg } from "../lib/alerty/pinArt";
import { CITIZEN_CHARACTER_IDS } from "../lib/alerty/characters";
import { PIN_CATEGORY_IDS } from "../lib/alerty/categoryIcons";

mkdirSync("/opt/cursor/artifacts/screenshots", { recursive: true });
mkdirSync("/tmp/pin-preview", { recursive: true });

const cats = ["balacera", "accidente", "bloqueo", "inundacion", "sos", "incendio"];

const citizens = CITIZEN_CHARACTER_IDS.slice(0, 6)
  .map((id, i) =>
    citizenPinSvg({
      characterId: id,
      category: cats[i],
      showBadge: true,
      showName: i === 1,
      name: "@chuy_tresrios",
    }),
  )
  .join("");

const pulsos = [
  pulsoPinSvg({
    category: "balacera",
    logoUrl: "https://www.google.com/s2/favicons?domain=lineadirectaportal.com&sz=64",
    showName: true,
    name: "Noticias LN",
  }),
  pulsoPinSvg({ category: "incendio", source: "rss" }),
  pulsoPinSvg({ category: "inundacion", source: "x" }),
  pulsoPinSvg({
    category: "detonaciones",
    logoUrl: "https://www.google.com/s2/favicons?domain=example.com&sz=64",
    extraSources: 3,
  }),
  pulsoPinSvg({ category: "desaparecida", source: "rss" }),
  pulsoPinSvg({ category: "operativo", source: "x" }),
].join("");

const aliados = [
  sponsorPinSvg({ zoneType: "anuncio", giro: "cafe", showName: true, name: "Café Lomas" }),
  sponsorPinSvg({ zoneType: "refugio", giro: "casa" }),
].join("");

function page(bg: string, label: string, dark: boolean) {
  return `<!doctype html><html><head><meta charset="utf-8"/><style>
  body{margin:0;font-family:system-ui;background:${bg};color:${dark ? "#f5f5f5" : "#1a1a1a"}}
  .map{min-height:100vh;padding:24px;background-image:
    linear-gradient(${dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"} 1px, transparent 1px),
    linear-gradient(90deg, ${dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"} 1px, transparent 1px);
    background-size:40px 40px}
  h1{font-size:18px;margin:0 0 8px}
  h2{font-size:13px;opacity:.7;margin:20px 0 10px}
  .row{display:flex;flex-wrap:wrap;gap:18px;align-items:flex-end}
  .pin svg{filter:drop-shadow(0 2px 4px rgba(0,0,0,.25))}
  </style></head><body><div class="map">
  <h1>Pulso · pines ${label}</h1>
  <h2>Ciudadanos</h2><div class="row pin">${citizens}</div>
  <h2>Pulsos</h2><div class="row pin">${pulsos}</div>
  <h2>Aliados</h2><div class="row pin">${aliados}</div>
  <p style="margin-top:24px;font-size:12px;opacity:.6">Categorías: ${PIN_CATEGORY_IDS.join(", ")}</p>
  </div></body></html>`;
}

writeFileSync("/tmp/pin-preview/light.html", page("#E8E6E1", "claro", false));
writeFileSync("/tmp/pin-preview/dark.html", page("#1B1F24", "oscuro", true));
console.log("ok");
