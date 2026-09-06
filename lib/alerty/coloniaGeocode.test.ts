/**
 * Smoke tests for colonia-from-text geocoding (no Jest in package.json).
 * Run: npm run test:colonia
 */
import {
  extractColoniasFromText,
  resolveTextColonia,
  resolveCommunityGeo,
  resolveDestinationQuery,
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
    fallbackLabel: "Sinaloa (noticia)",
    allowCityApprox: true,
  });
  assert(rssCity.mapEligible === true, "RSS city-only gets a pin");
  assert(rssCity.placeLabel === "Culiacán (aproximado)", rssCity.placeLabel);
  assert(typeof rssCity.lat === "number" && typeof rssCity.lng === "number", "approx coords");

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

  console.log("coloniaGeocode tests: OK");
}

run();
