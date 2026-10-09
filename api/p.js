/**
 * Landing pública /p/<id> con OG tags para WhatsApp.
 * id = uuid (alerta) o c-<uuid> (community post).
 * Abre sin forzar descarga. vercel.json reescribe /p/:id → /api/p?id=:id
 */

const {
  APP,
  CATEGORY_LABELS,
  actionLineFor,
  cleanShareTitle,
  esc,
  loadPulse,
} = require("./_pulseShared");

function pageHtml(pulse) {
  const cat = pulse.category || "otro";
  const city = pulse.cityName;
  const citySlug = pulse.citySlug;
  const label = CATEGORY_LABELS[cat] || cat;
  // loadPulse ya limpia community; re-aplicar por si es alerta o cache viejo.
  const headline = cleanShareTitle(pulse.title, label, 100);
  const action = actionLineFor(cat);
  const cleared = pulse.status === "resolved";
  const place = pulse.place;
  const publicId = pulse.publicId;
  const url = `${APP}/p/${publicId}`;
  const ogImage = `${APP}/api/og?id=${encodeURIComponent(publicId)}`;
  const desc = action ? `${action} · ${place}` : `${place} · Pulso ${city}`;
  const appLink = `${APP}/?city=${encodeURIComponent(citySlug)}`;
  const source = pulse.sourceHint || "aviso de vecinos";

  return `<!DOCTYPE html>
<html lang="es-MX">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${esc(headline)} · Pulso ${esc(city)}</title>
  <meta name="description" content="${esc(desc)}"/>
  <link rel="canonical" href="${esc(url)}"/>
  <meta property="og:type" content="article"/>
  <meta property="og:locale" content="es_MX"/>
  <meta property="og:site_name" content="Pulso Ciudadano"/>
  <meta property="og:title" content="${esc(headline)} · ${esc(city)}"/>
  <meta property="og:description" content="${esc(desc)}"/>
  <meta property="og:url" content="${esc(url)}"/>
  <meta property="og:image" content="${esc(ogImage)}"/>
  <meta property="og:image:type" content="image/png"/>
  <meta property="og:image:width" content="1200"/>
  <meta property="og:image:height" content="630"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${esc(headline)} · ${esc(city)}"/>
  <meta name="twitter:description" content="${esc(desc)}"/>
  <meta name="twitter:image" content="${esc(ogImage)}"/>
  <meta name="theme-color" content="#F6F2EA"/>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh;
      font-family: "Segoe UI", system-ui, sans-serif;
      background: linear-gradient(145deg, #F6F2EA 0%, #EFE6D7 100%);
      color: #1B1A17;
    }
    main { max-width: 520px; margin: 0 auto; padding: 32px 20px 48px; }
    .brand { font-weight: 800; letter-spacing: 0.08em; font-size: 14px; }
    .city { color: #6A6257; margin-top: 4px; font-size: 15px; }
    .card {
      margin-top: 28px; background: #fff; border: 1px solid #E1D4C2;
      border-radius: 18px; padding: 22px; border-left: 5px solid #D9552B;
    }
    .pill {
      display: inline-block; font-size: 12px; font-weight: 700;
      color: #D9552B; background: rgba(217,85,43,0.12);
      padding: 6px 12px; border-radius: 999px; margin-bottom: 12px;
    }
    h1 { font-size: 1.45rem; line-height: 1.3; margin: 0 0 12px; }
    .action { color: #1B1A17; font-size: 1.05rem; margin: 0 0 16px; }
    .meta { color: #6A6257; font-size: 0.9rem; }
    .cleared {
      display: inline-block; margin-top: 14px; background: #1F9D6E; color: #fff;
      font-weight: 700; font-size: 13px; padding: 8px 14px; border-radius: 999px;
    }
    .cta {
      display: block; margin-top: 28px; text-align: center; text-decoration: none;
      background: #1B1A17; color: #F6F2EA; font-weight: 700;
      padding: 16px 20px; border-radius: 14px;
    }
    .cta-sub { text-align: center; color: #6A6257; font-size: 0.9rem; margin-top: 12px; }
    .foot { margin-top: 36px; color: #6A6257; font-size: 0.8rem; line-height: 1.45; }
  </style>
</head>
<body>
  <main>
    <div class="brand">PULSO</div>
    <div class="city">${esc(city)}</div>
    <article class="card">
      <span class="pill">${esc(label)}</span>
      <h1>${esc(headline)}</h1>
      ${action ? `<p class="action">${esc(action)}</p>` : ""}
      <p class="meta">${esc(place)} · ${esc(source)}</p>
      ${cleared ? '<span class="cleared">Ya se despejó</span>' : ""}
    </article>
    <a class="cta" href="${esc(appLink)}">Recibe avisos de tu colonia</a>
    <p class="cta-sub">Sin descarga obligatoria · abre Pulso en el navegador</p>
    <p class="foot">Pulso informa para cuidarse. No es denuncia ni sustituye al 911. Los operativos van con retraso y sin ubicación en vivo.</p>
  </main>
</body>
</html>`;
}

function notFoundHtml() {
  return `<!DOCTYPE html><html lang="es-MX"><head>
<meta charset="utf-8"/><title>Pulso · aviso no encontrado</title>
<meta name="robots" content="noindex"/>
<style>body{font-family:system-ui;background:#F6F2EA;color:#1B1A17;padding:40px 20px;text-align:center}
a{color:#D9552B}</style></head>
<body><h1>Este aviso ya no está disponible</h1>
<p>Puede haberse despejado o retirado.</p>
<p><a href="${APP}">Ir a Pulso</a></p></body></html>`;
}

module.exports = async function handler(req, res) {
  const id = (req.query && req.query.id) || "";
  let pulse = null;
  try {
    pulse = await loadPulse(id);
  } catch {
    pulse = null;
  }

  if (!pulse) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(404).send(notFoundHtml());
    return;
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  res.status(200).send(pageHtml(pulse));
};
