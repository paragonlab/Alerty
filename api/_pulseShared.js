/**
 * Helpers compartidos por /api/p y /api/og (CommonJS, sin deps de la app Expo).
 */

const APP = "https://pulso-ciudadano.com";
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const OPERATIVO_DELAY_MS = 2 * 60 * 60 * 1000;
const COMMUNITY_PREFIX = "c-";

const CITY_BY_ID = {
  "c0a1c000-0001-4000-8000-000000000001": { name: "Culiacán", slug: "culiacan" },
  "c0a1c000-0002-4000-8000-000000000002": { name: "Mazatlán", slug: "mazatlan" },
};

const CATEGORY_LABELS = {
  balacera: "Balacera",
  narcobloqueo: "Narcobloqueo",
  enfrentamiento: "Enfrentamiento",
  detonaciones: "Detonaciones",
  bloqueo: "Bloqueo vial",
  captura: "Captura",
  robo: "Robo",
  accidente: "Accidente vial",
  incendio: "Incendio",
  inundacion: "Inundación",
  "zona segura": "Zona segura",
  sos: "SOS",
  desaparecida: "Persona desaparecida",
  operativo: "Operativo",
  alerta: "Aviso",
  otro: "Noticia",
};

const CATEGORY_COLORS = {
  balacera: "#D9342B",
  enfrentamiento: "#A31D24",
  detonaciones: "#E9792F",
  narcobloqueo: "#74203F",
  bloqueo: "#F4A11D",
  captura: "#B5561F",
  robo: "#C79A1E",
  accidente: "#F2C83A",
  incendio: "#EF4B23",
  inundacion: "#2E7DD1",
  "zona segura": "#1F9D6E",
  sos: "#E0115F",
  alerta: "#FF7A59",
  desaparecida: "#8A4FD6",
  operativo: "#26418F",
  otro: "#6B7280",
};

const ACTION = {
  balacera: "Mejor evita la zona un rato y espera más avisos.",
  narcobloqueo: "Busca otra ruta; no te acerques a grabar.",
  enfrentamiento: "Aléjate con calma y no pases por ahí.",
  detonaciones: "Mantente lejos hasta que haya más reportes.",
  bloqueo: "Mejor rodea; el tráfico puede estar parado.",
  captura: "Puede haber retenes cercanos; pasa con paciencia.",
  robo: "Ten cuidado en la zona y avisa si ves algo raro.",
  accidente: "Pasa con precaución; puede haber lentitud.",
  incendio: "Aléjate del humo; no te acerques a grabar.",
  inundacion: "Evita calles bajas y zonas anegadas.",
  "zona segura": "Punto de referencia de vecinos en la zona.",
  sos: "Si puedes ayudar con seguridad, abre el mapa. No sustituye al 911.",
  desaparecida: "Comparte solo datos verificados; evita rumores.",
  operativo: "Información con retraso · sin ubicación en vivo.",
  alerta: "Échale un ojo a la zona y decide con calma.",
  otro: "Revisa el aviso y confirma con otras fuentes.",
};

const SMALL = new Set(["a", "al", "con", "de", "del", "el", "en", "la", "las", "los", "para", "por", "un", "una", "y"]);

const PLACE_CANON = [
  "Las Quintas",
  "Tres Ríos",
  "La Campiña",
  "La Obregón",
  "Obregón",
  "Boulevares",
  "Adolfo López Mateos",
  "Lomas del Boulevard",
  "Gustavo Díaz Ordaz",
  "Culiacán",
  "Mazatlán",
  "Sinaloa",
  "Centro",
  "Zona Dorada",
  "Olas Altas",
];

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fold(s) {
  return String(s)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("es-MX");
}

function toTitleCaseEs(text) {
  const parts = text.toLocaleLowerCase("es-MX").split(/(\s+)/);
  let wordIndex = 0;
  return parts
    .map((part) => {
      if (/^\s+$/.test(part) || !part) return part;
      const isFirst = wordIndex === 0;
      wordIndex += 1;
      if (!isFirst && SMALL.has(part)) return part;
      return part.charAt(0).toLocaleUpperCase("es-MX") + part.slice(1);
    })
    .join("");
}

function applyGazetteerCasing(text) {
  let out = text;
  const sorted = [...PLACE_CANON].sort((a, b) => b.length - a.length);
  for (const name of sorted) {
    const needle = fold(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    const re = new RegExp(`(^|[^\\p{L}])(${needle})(?![\\p{L}])`, "giu");
    out = out.replace(re, (_, pre) => `${pre}${name}`);
  }
  return out;
}

function displayTitle(raw, fallback) {
  let out = String(raw || fallback || "Aviso en tu zona").trim();
  out = out.replace(/[\u{1F6A8}\u{1F525}\u{26A0}\u{1F4A5}]/gu, "").replace(/\s{2,}/g, " ").trim();
  const letters = out.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, "");
  if (letters.length >= 8) {
    const upper = letters.replace(/[^A-ZÁÉÍÓÚÜÑ]/g, "").length;
    if (upper / letters.length >= 0.75) {
      out = toTitleCaseEs(out);
    }
  }
  return applyGazetteerCasing(out);
}

function parsePublicId(rawId) {
  const id = String(rawId || "");
  if (id.startsWith(COMMUNITY_PREFIX)) {
    return { kind: "community", id: id.slice(COMMUNITY_PREFIX.length), publicId: id };
  }
  return { kind: "alert", id, publicId: id };
}

async function supabaseGet(path) {
  if (!SUPABASE_URL || !SUPABASE_ANON) return null;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
    },
  });
  if (!r.ok) return null;
  const rows = await r.json();
  return Array.isArray(rows) ? rows[0] : null;
}

function operativoReady(createdAt) {
  const at = new Date(createdAt).getTime();
  if (!Number.isFinite(at)) return false;
  return Date.now() - at >= OPERATIVO_DELAY_MS;
}

/**
 * @returns {Promise<null | {
 *   kind: 'alert'|'community',
 *   publicId: string,
 *   category: string,
 *   title: string,
 *   place: string,
 *   cityName: string,
 *   citySlug: string,
 *   status: string,
 *   createdAt: string,
 *   showMap: boolean,
 * }>}
 */
async function loadPulse(rawId) {
  const { kind, id, publicId } = parsePublicId(rawId);
  if (!id) return null;

  if (kind === "community") {
    const row = await supabaseGet(
      `community_posts?id=eq.${encodeURIComponent(id)}` +
        `&select=id,text,category_guess,place_label,created_at,city_id,source,author_handle`,
    );
    if (!row) return null;
    const cat = row.category_guess || "otro";
    if (cat === "operativo" && !operativoReady(row.created_at)) return null;
    const cityMeta = CITY_BY_ID[row.city_id] || { name: "Culiacán", slug: "culiacan" };
    const place =
      cat === "operativo" ? cityMeta.name : row.place_label || cityMeta.name;
    return {
      kind: "community",
      publicId,
      category: cat,
      title: row.text || CATEGORY_LABELS[cat] || cat,
      place,
      cityName: cityMeta.name,
      citySlug: cityMeta.slug,
      status: "active",
      createdAt: row.created_at,
      showMap: cat !== "operativo",
      sourceHint: row.source === "rss" ? "Noticia" : "Desde X",
    };
  }

  const row = await supabaseGet(
    `alerts?id=eq.${encodeURIComponent(id)}` +
      `&select=id,category,title,description,status,created_at,city_id`,
  );
  if (!row) return null;
  if (row.category === "operativo" && !operativoReady(row.created_at)) return null;
  const cityMeta = CITY_BY_ID[row.city_id] || { name: "Culiacán", slug: "culiacan" };
  return {
    kind: "alert",
    publicId,
    category: row.category || "otro",
    title: row.title || row.description || CATEGORY_LABELS[row.category] || "Aviso",
    place: row.category === "operativo" ? cityMeta.name : cityMeta.name,
    cityName: cityMeta.name,
    citySlug: cityMeta.slug,
    status: row.status || "active",
    createdAt: row.created_at,
    showMap: row.category !== "operativo",
    sourceHint: "aviso de vecinos",
  };
}

function svgFor(model) {
  const accent = CATEGORY_COLORS[model.category] || "#6B7280";
  const cat = CATEGORY_LABELS[model.category] || model.category;
  const headline = displayTitle(model.title, cat).slice(0, 90);
  const action = (ACTION[model.category] || ACTION.otro).slice(0, 80);
  const cleared = model.status === "resolved";
  const badge = cleared
    ? `<rect x="64" y="520" rx="16" width="200" height="44" fill="#1F9D6E"/>
       <text x="164" y="549" text-anchor="middle" fill="#fff" font-family="DejaVu Sans,system-ui,sans-serif" font-size="22" font-weight="700">Ya se despejó</text>`
    : "";
  const map = model.showMap
    ? `<circle cx="980" cy="220" r="90" fill="${accent}" fill-opacity="0.12"/>
       <circle cx="980" cy="220" r="28" fill="${accent}"/>
       <circle cx="980" cy="220" r="10" fill="#F6F2EA"/>`
    : `<text x="980" y="230" text-anchor="middle" fill="#6A6257" font-family="DejaVu Sans,system-ui,sans-serif" font-size="20">Sin mapa en vivo</text>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#F6F2EA"/>
      <stop offset="100%" stop-color="#EFE6D7"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="0" y="0" width="12" height="630" fill="${accent}"/>
  <text x="64" y="88" fill="#1B1A17" font-family="DejaVu Sans,system-ui,sans-serif" font-size="28" font-weight="700" letter-spacing="1">PULSO</text>
  <text x="64" y="122" fill="#6A6257" font-family="DejaVu Sans,system-ui,sans-serif" font-size="20">${esc(model.cityName)}</text>
  <rect x="64" y="160" rx="18" width="${Math.min(360, 48 + cat.length * 14)}" height="40" fill="${accent}" fill-opacity="0.14"/>
  <text x="84" y="187" fill="${accent}" font-family="DejaVu Sans,system-ui,sans-serif" font-size="20" font-weight="600">${esc(cat)}</text>
  <text x="64" y="280" fill="#1B1A17" font-family="DejaVu Sans,system-ui,sans-serif" font-size="40" font-weight="700">${esc(headline)}</text>
  <text x="64" y="340" fill="#6A6257" font-family="DejaVu Sans,system-ui,sans-serif" font-size="24">${esc(model.place)}</text>
  <text x="64" y="400" fill="#1B1A17" font-family="DejaVu Sans,system-ui,sans-serif" font-size="26">${esc(action)}</text>
  ${badge}
  ${map}
  <text x="64" y="590" fill="#6A6257" font-family="DejaVu Sans,system-ui,sans-serif" font-size="18">Informar para cuidarse · pulso-ciudadano.com</text>
</svg>`;
}

function renderPng(svg) {
  try {
    const { Resvg } = require("@resvg/resvg-js");
    const resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: 1200 },
      font: { loadSystemFonts: true },
    });
    return resvg.render().asPng();
  } catch (err) {
    console.error("PNG render failed", err && err.message);
    return null;
  }
}

module.exports = {
  APP,
  ACTION,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  displayTitle,
  esc,
  loadPulse,
  svgFor,
  renderPng,
  parsePublicId,
};
