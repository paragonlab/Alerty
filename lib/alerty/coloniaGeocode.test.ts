/**
 * Smoke tests for colonia-from-text geocoding (no Jest in package.json).
 * Run: npm run test:colonia
 */
import {
  extractColoniasFromText,
  resolveTextColonia,
  resolveCommunityGeo,
  resolveCommunityMapPoint,
  resolveDestinationQuery,
  suggestDestinationPlaces,
  CULIACAN_PLACES,
} from "./coloniaGeocode";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function run() {
  assert(
    CULIACAN_PLACES.some((p) => p.name === "Guadalupe"),
    "gazetteer includes Guadalupe",
  );
  assert(
    CULIACAN_PLACES.some((p) => p.name === "Adolfo López Mateos"),
    "gazetteer includes Adolfo López Mateos",
  );

  const lopez = resolveTextColonia(
    "Balacera ocurrió en la colonia Adolfo López Mateos de Culiacán la madrugada de este viernes.",
  );
  assert(lopez && !lopez.ambiguous, "explicit colonia phrase resolves");
  assert(lopez!.place.name === "Adolfo López Mateos", `got ${lopez!.place.name}`);
  assert(lopez!.confidence === "high", "event+colonia phrase is high confidence");

  const guad = resolveTextColonia("Reportan bloqueo en colonia Guadalupe, Culiacán.");
  assert(guad?.place.name === "Guadalupe", "Guadalupe phrase");

  const mismatch = resolveCommunityGeo({
    text: "El incidente ocurrió en la colonia Adolfo López Mateos, Culiacán.",
    placeBboxCenter: { lat: 24.7997, lng: -107.4068 },
    publisherPlaceLabel: "Guadalupe, Culiacán",
    fallbackLabel: "Culiacán (X)",
  });
  assert(mismatch.geoSource === "text_colonia", "prefer text over publisher Guadalupe");
  assert(mismatch.placeLabel === "Adolfo López Mateos", mismatch.placeLabel);
  assert(mismatch.placeNameSource === "Guadalupe, Culiacán", "keep publisher label");
  assert(mismatch.mapEligible === true, "map eligible");

  const cityOnly = resolveCommunityGeo({
    text: "Reportan accidente en colonia Las Quintas",
    placeBboxCenter: { lat: 24.8, lng: -107.39 },
    publisherPlaceLabel: "Culiacán, Sinaloa",
    fallbackLabel: "Culiacán (X)",
  });
  assert(cityOnly.geoSource === "text_colonia", "city place + colonia text");
  assert(cityOnly.placeLabel === "Las Quintas", cityOnly.placeLabel);

  const ambiguous = resolveCommunityGeo({
    text: "Hay reportes en Guadalupe y en Chapultepec esta tarde.",
    fallbackLabel: "Culiacán (X)",
  });
  assert(ambiguous.mapEligible === false, "ambiguous → no pin");
  assert(ambiguous.lat === null, "no coords when ambiguous");

  const coordsWin = resolveCommunityGeo({
    text: "Estoy en colonia Guadalupe, todo tranquilo por ahora.",
    coords: { lat: 24.801, lng: -107.407 },
    publisherPlaceLabel: "Guadalupe",
    fallbackLabel: "Culiacán (X)",
  });
  assert(coordsWin.geoSource === "tweet_coords", "matching colonia keeps tweet coords");
  assert(coordsWin.lat === 24.801, "coords preserved");

  const hits = extractColoniasFromText("Accidente en col. Tres Ríos cerca del periférico");
  assert(hits[0]?.place.name === "Tres Ríos", "col. abbreviation works");

  const rssCity = resolveCommunityGeo({
    text: "Reportan balacera en Culiacán esta tarde.",
    title: "Balacera en Culiacán",
    fallbackLabel: "Culiacán (noticia)",
    allowCityApprox: false,
    requireCuliacanMention: true,
  });
  assert(rssCity.mapEligible === false, "RSS city-only stays off the map");
  assert(rssCity.lat === null, "no invented downtown pin");

  const mazatlan = resolveCommunityGeo({
    text: "Reportan bloqueo en el centro de Mazatlán esta tarde.",
    title: "Bloqueo en Mazatlán",
    fallbackLabel: "Culiacán (noticia)",
    allowCityApprox: true,
    requireCuliacanMention: true,
  });
  assert(mazatlan.mapEligible === false, "Mazatlán is not a Culiacán pin");
  assert(mazatlan.lat === null, "Mazatlán has no coords");

  const rssColonia = resolveCommunityGeo({
    text: "El incidente ocurrió en la colonia Las Quintas, Culiacán.",
    title: "Balacera en Las Quintas",
    fallbackLabel: "Culiacán (noticia)",
    allowCityApprox: false,
    requireCuliacanMention: true,
  });
  assert(rssColonia.mapEligible === true, "Culiacán + colonia pins");
  assert(rssColonia.placeLabel === "Las Quintas", rssColonia.placeLabel);

  const stillAmbiguous = resolveCommunityGeo({
    text: "Hay reportes en Guadalupe y en Chapultepec esta tarde.",
    fallbackLabel: "Sinaloa (noticia)",
    allowCityApprox: true,
  });
  assert(stillAmbiguous.mapEligible === false, "ambiguous stays off the map");

  const guadalupePhrase = resolveTextColonia("Reportan bloqueo en colonia Guadalupe, Culiacán.");
  assert(guadalupePhrase?.place.name === "Guadalupe", "Guadalupe not swallowed by Guadalupe Victoria");

  const destQuintas = resolveDestinationQuery("Las Quintas");
  assert(destQuintas?.placeLabel === "Las Quintas", "destination Las Quintas");
  const destQuintasShort = resolveDestinationQuery("quintas");
  assert(destQuintasShort?.placeLabel === "Las Quintas", "destination quintas");
  assert(resolveDestinationQuery("las") === null, "short las is not a destination");
  const destGuad = resolveDestinationQuery("Guadalupe");
  assert(destGuad?.placeLabel === "Guadalupe", "destination Guadalupe");
  assert(resolveDestinationQuery("xx") === null, "unknown destination");

  const quin = suggestDestinationPlaces("quin");
  assert(quin[0]?.name === "Las Quintas", "suggest quintas");
  const gua = suggestDestinationPlaces("gua").map((p) => p.name);
  assert(gua.includes("Guadalupe"), "suggest Guadalupe");
  assert(suggestDestinationPlaces("").length === 0, "empty suggest");

  assert(
    CULIACAN_PLACES.some((p) => p.name === "Jesús María"),
    "gazetteer includes Jesús María",
  );
  const jesus = resolveTextColonia(
    "Enfrentamiento en Jesús María, Culiacán deja personas detenidas.",
  );
  assert(jesus?.place.name === "Jesús María", `Jesús María from news text, got ${jesus?.place.name}`);

  assert(
    CULIACAN_PLACES.some((p) => p.name === "Lomas del Bulevar"),
    "gazetteer includes Lomas del Bulevar",
  );
  const nmasLomas = resolveTextColonia("balacera en la colonia Lomas del Bulevar");
  assert(nmasLomas && !nmasLomas.ambiguous, "NMás Lomas del Bulevar resolves");
  assert(nmasLomas!.place.name === "Lomas del Bulevar", `got ${nmasLomas!.place.name}`);
  assert(nmasLomas!.confidence === "high", "colonia Lomas del Bulevar is high confidence");
  assert(nmasLomas!.place.name !== "Boulevares", "must not confuse with Boulevares");

  const lomasHits = extractColoniasFromText("balacera en la colonia Lomas del Bulevar");
  assert(lomasHits[0]?.place.name === "Lomas del Bulevar", "extract top hit is Lomas del Bulevar");
  assert(
    !lomasHits.some((h) => h.place.name === "Boulevares"),
    "Boulevares must not appear for Lomas del Bulevar text",
  );

  const boulevardVariant = resolveTextColonia(
    "Reportan enfrentamiento en la colonia Lomas del Boulevard, Culiacán.",
  );
  assert(
    boulevardVariant?.place.name === "Lomas del Bulevar",
    `Boulevard spelling, got ${boulevardVariant?.place.name}`,
  );

  const lomasOverCityBbox = resolveCommunityGeo({
    text: "balacera en la colonia Lomas del Bulevar",
    placeBboxCenter: { lat: 24.81, lng: -107.39 },
    publisherPlaceLabel: "Culiacán, Sinaloa",
    fallbackLabel: "Culiacán (X)",
  });
  assert(lomasOverCityBbox.geoSource === "text_colonia", "city place_bbox yields to Lomas text");
  assert(lomasOverCityBbox.placeLabel === "Lomas del Bulevar", lomasOverCityBbox.placeLabel);
  assert(lomasOverCityBbox.lat === 24.7898, "Lomas centroid lat");
  assert(lomasOverCityBbox.lng === -107.4253, "Lomas centroid lng");

  const lomasMapPoint = resolveCommunityMapPoint({
    lat: 24.81,
    lng: -107.39,
    text: "balacera en la colonia Lomas del Bulevar",
    placeLabel: "Culiacán (aproximado)",
    geoSource: "place_bbox",
  });
  assert(lomasMapPoint?.placeLabel === "Lomas del Bulevar", "map upgrades stale city pin via text");
  assert(lomasMapPoint?.lat === 24.7898, "map pin at Lomas");

  const cityOnlyNoPin = resolveCommunityMapPoint({
    lat: null,
    lng: null,
    text: "Operación de la Marina y la FGR en Culiacán inhabilitó un complejo clandestino.",
    source: "rss",
    placeLabel: "Culiacán (noticia)",
  });
  assert(cityOnlyNoPin === null, "RSS city-only stays Feed-only (no Centro pin)");

  const staleCityPin = resolveCommunityMapPoint({
    lat: 24.8091,
    lng: -107.394,
    text: "Reportan balacera en Culiacán esta tarde.",
    placeLabel: "Culiacán (aproximado)",
    geoSource: "place_bbox",
  });
  assert(staleCityPin === null, "city-approx coords do not become Centro map pins");

  console.log("coloniaGeocode tests: OK");
}

run();
