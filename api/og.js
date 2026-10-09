/**
 * OG image PNG para un pulso: /api/og?id=<uuid|c-<uuid>>&surface=video?
 * WhatsApp/Facebook requieren PNG/JPEG (SVG no se previsualiza).
 * Sin coordenadas precisas; operativo → solo ciudad + delay 2h.
 * surface=video → miniatura + badge Video cuando hay media.
 */

const {
  loadPulse,
  fetchThumbDataUri,
  svgFor,
  renderPng,
  CATEGORY_LABELS,
  ACTION,
  CATEGORY_COLORS,
  displayTitle,
} = require("./_pulseShared");

module.exports = async function handler(req, res) {
  const id = (req.query && req.query.id) || "";
  const surface = (req.query && req.query.surface) === "video" ? "video" : "feed";
  let model = {
    category: "otro",
    title: "Aviso en tu zona",
    place: "Sinaloa",
    cityName: "Culiacán",
    status: "active",
    showMap: true,
    surface,
  };

  try {
    const pulse = await loadPulse(id);
    if (pulse) {
      let thumbDataUri = null;
      if (surface === "video" && pulse.thumbUrl) {
        thumbDataUri = await fetchThumbDataUri(pulse.thumbUrl);
      }
      model = {
        category: pulse.category,
        title: pulse.title,
        place: pulse.place,
        cityName: pulse.cityName,
        status: pulse.status,
        showMap: pulse.showMap,
        surface,
        thumbDataUri,
        hasVideo: pulse.hasVideo,
      };
    }
  } catch {
    /* fallback genérico */
  }

  const svg = svgFor(model);
  const png = renderPng(svg);

  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");

  if (png) {
    res.setHeader("Content-Type", "image/png");
    res.status(200).send(png);
    return;
  }

  // Fallback raro (sin binario nativo): SVG — mejor que 500.
  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.status(200).send(svg);
};

// Evita tree-shake warnings en algunos bundlers.
void CATEGORY_LABELS;
void ACTION;
void CATEGORY_COLORS;
void displayTitle;
