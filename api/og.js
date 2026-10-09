/**
 * OG image (SVG) para un pulso: /api/og?id=<uuid>
 * Usado por WhatsApp / redes al previsualizar /p/<id>.
 * Sin coordenadas precisas; operativo → solo ciudad.
 */

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

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
  sos: "Si puedes ayudar con seguridad, abre el mapa.",
  desaparecida: "Comparte solo datos verificados.",
  operativo: "Información con retraso · sin ubicación en vivo.",
  alerta: "Échale un ojo a la zona y decide con calma.",
  otro: "Revisa el aviso y confirma con otras fuentes.",
};

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function displayTitle(raw, fallback) {
  let out = String(raw || fallback || "Aviso en tu zona").trim();
  out = out.replace(/[\u{1F6A8}\u{1F525}\u{26A0}\u{1F4A5}]/gu, "").replace(/\s{2,}/g, " ").trim();
  const letters = out.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, "");
  if (letters.length >= 8) {
    const upper = letters.replace(/[^A-ZÁÉÍÓÚÜÑ]/g, "").length;
    if (upper / letters.length >= 0.75) {
      out = out.toLocaleLowerCase("es-MX");
      out = out.charAt(0).toUpperCase() + out.slice(1);
    }
  }
  return out.slice(0, 90);
}

function svgFor({ headline, cat, place, action, accent, cleared, showMap }) {
  const badge = cleared
    ? `<rect x="64" y="520" rx="16" width="200" height="44" fill="#1F9D6E"/>
       <text x="164" y="549" text-anchor="middle" fill="#fff" font-family="system-ui,sans-serif" font-size="22" font-weight="700">Ya se despejó</text>`
    : "";
  const map = showMap
    ? `<circle cx="980" cy="220" r="90" fill="${accent}" fill-opacity="0.12"/>
       <circle cx="980" cy="220" r="28" fill="${accent}"/>
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
  <rect x="0" y="0" width="12" height="630" fill="${accent}"/>
  <text x="64" y="88" fill="#1B1A17" font-family="system-ui,sans-serif" font-size="28" font-weight="700" letter-spacing="1">PULSO</text>
  <text x="64" y="122" fill="#6A6257" font-family="system-ui,sans-serif" font-size="20">${esc(place)}</text>
  <rect x="64" y="160" rx="18" width="${Math.min(320, 40 + cat.length * 14)}" height="40" fill="${accent}" fill-opacity="0.14"/>
  <text x="84" y="187" fill="${accent}" font-family="system-ui,sans-serif" font-size="20" font-weight="600">${esc(cat)}</text>
  <text x="64" y="280" fill="#1B1A17" font-family="system-ui,sans-serif" font-size="42" font-weight="700">${esc(headline)}</text>
  <text x="64" y="400" fill="#1B1A17" font-family="system-ui,sans-serif" font-size="26">${esc(action)}</text>
  ${badge}
  ${map}
  <text x="64" y="590" fill="#6A6257" font-family="system-ui,sans-serif" font-size="18">Informar para cuidarse · pulso-ciudadano.com</text>
</svg>`;
}

module.exports = async function handler(req, res) {
  const id = (req.query && req.query.id) || "";
  let cat = "otro";
  let title = "Aviso en tu zona";
  let place = "Sinaloa";
  let status = "active";
  let cityName = "Culiacán";

  if (id && SUPABASE_URL && SUPABASE_ANON) {
    try {
      const CITY_BY_ID = {
        "c0a1c000-0001-4000-8000-000000000001": "Culiacán",
        "c0a1c000-0002-4000-8000-000000000002": "Mazatlán",
      };
      const url =
        `${SUPABASE_URL}/rest/v1/alerts?id=eq.${encodeURIComponent(id)}` +
        `&select=id,category,title,status,city_id`;
      const r = await fetch(url, {
        headers: {
          apikey: SUPABASE_ANON,
          Authorization: `Bearer ${SUPABASE_ANON}`,
        },
      });
      const rows = await r.json();
      const row = Array.isArray(rows) ? rows[0] : null;
      if (row) {
        cat = row.category || cat;
        title = row.title || title;
        status = row.status || status;
        cityName = CITY_BY_ID[row.city_id] || cityName;
        place = cityName;
      }
    } catch {
      /* fallback genérico */
    }
  }

  const accent = CATEGORY_COLORS[cat] || "#6B7280";
  const svg = svgFor({
    headline: displayTitle(title, CATEGORY_LABELS[cat] || cat),
    cat: CATEGORY_LABELS[cat] || cat,
    place,
    action: ACTION[cat] || ACTION.otro,
    accent,
    cleared: status === "resolved",
    showMap: cat !== "operativo",
  });

  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
  res.status(200).send(svg);
};
