/**
 * deno test --allow-env supabase/functions/_shared/tomtom.test.ts
 */
import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { CITY_IDS } from "./cities.ts";
import {
  TOMTOM_BBOXES,
  TOMTOM_BUDGET,
  TOMTOM_MAX_BBOX_KM2,
  ALIADO_CORRIDOR_MAX_KM,
  CURATED_MEX15D_TOLL_BOOTHS,
  EV_NAME_DEDUPE_METERS,
  MAX_TRIP_LENGTH_KM,
  POI_DEDUPE_METERS,
  TOLL_NEAR_CURATED_KM,
  TOMTOM_POI_CACHE_KEY,
  TRIP_ROUTE_CHIPS,
  TOMTOM_POI_CACHE_TTL_EMPTY_SEC,
  TOMTOM_POI_CATEGORIES,
  TOMTOM_POI_MAX_RADIUS_M,
  TOMTOM_POI_REQUEST_GAP_MS,
  TOMTOM_POI_SAMPLE_POINTS,
  TOMTOM_TRAVEL_RATE,
  aliadoMatchesPoiKind,
  bboxAreaKm2,
  bboxesOverlap,
  buildPoiFetchPlan,
  calmIncidentText,
  cityIdForIncident,
  clientIpFromHeaders,
  dedupePoisByNamePos,
  extraMinutesFromFlow,
  isFreshTomtomIncident,
  isAllowedTravelPoint,
  isGenericTollName,
  isInMexico,
  isKnownMex15dTrip,
  isNearCuratedToll,
  isTravelCommunityRowAllowed,
  normalizePlacesQuery,
  NON_PRESET_POI_SAMPLES,
  PLACES_QUERY_MAX_LEN,
  TOMTOM_DAILY_NON_PRESET_CAP,
  tripPoiKindsForBudget,
  mapTomtomCategory,
  mergeAliadosIntoPois,
  mergeCuratedTolls,
  minKmToCorridor,
  nameHasCasetaOrPlaza,
  parseCalculateRoute,
  parseFuzzySearch,
  parseIncidentDetails,
  parseNearbySearch,
  placesCacheKey,
  sampleAlongPolyline,
  pickPoisRoundRobinBySample,
  planTomtomNotifiesPerUser,
  poiCacheTtlSeconds,
  poiListsAreEmpty,
  poiMatchesExpectedCategory,
  pointFromIncidentGeometry,
  pointInBbox,
  poisNearDuplicate,
  rateLimitBucket,
  rateLimitCacheKey,
  resolveTravelEndpoints,
  selectIncidentsToResolve,
  tomtomDuplicatesAliado,
  tripCacheKey,
  validateTripEndpoints,
} from "./tomtom.ts";
import {
  FIXTURE_CALCULATE_ROUTE,
  FIXTURE_FLOW_SEGMENT,
  FIXTURE_INCIDENT_DETAILS,
  FIXTURE_NEARBY_GAS,
} from "./tomtomFixtures.ts";

Deno.test("mapTomtomCategory accidente / cierre / obras", () => {
  assertEquals(mapTomtomCategory(1).category, "accidente");
  assertEquals(mapTomtomCategory(8).category, "bloqueo");
  assertEquals(mapTomtomCategory(9).category, "bloqueo");
  assertEquals(mapTomtomCategory(6).category, "bloqueo");
  assertEquals(mapTomtomCategory(11).category, "inundacion");
});

Deno.test("calmIncidentText tono ameno sin alarmismo", () => {
  const t = calmIncidentText({
    iconCategory: 8,
    description: "Carril cerrado temporalmente",
    from: "km 120",
    to: "km 125",
    placeLabel: "México 15 / 15D",
  });
  assertStringIncludes(t, "tramo cerrado");
  assertStringIncludes(t, "México 15");
  assertEquals(/peligro|urgente|evita/i.test(t), false);
});

Deno.test("presupuesto incidents bajo free tier", () => {
  assertEquals(TOMTOM_BUDGET.estimatedIncidentRequestsPerDay <= 400, true);
  assertEquals(
    TOMTOM_BUDGET.estimatedIncidentRequestsPerDay +
      TOMTOM_BUDGET.estimatedFlowRequestsPerDay <
      TOMTOM_BUDGET.freeNonTilePerDay,
    true,
  );
});

Deno.test("bboxes ≤ 10k km² y corredor no solapa cajas ciudad", () => {
  const cityBoxes = TOMTOM_BBOXES.filter((b) => b.cityId);
  const corridorBoxes = TOMTOM_BBOXES.filter((b) => !b.cityId);
  assertEquals(corridorBoxes.length >= 2, true);

  for (const box of TOMTOM_BBOXES) {
    const area = bboxAreaKm2(box.bbox);
    assertEquals(
      area <= TOMTOM_MAX_BBOX_KM2,
      true,
      `${box.key} area=${area.toFixed(0)} > ${TOMTOM_MAX_BBOX_KM2}`,
    );
  }

  // El bbox monolítico viejo (~22k) quedaría fuera de límite.
  const legacyCorridor = "-107.50,23.20,-106.30,24.85";
  assertEquals(bboxAreaKm2(legacyCorridor) > TOMTOM_MAX_BBOX_KM2, true);

  for (const city of cityBoxes) {
    for (const corridor of corridorBoxes) {
      assertEquals(
        bboxesOverlap(city.bbox, corridor.bbox),
        false,
        `${city.key} overlaps ${corridor.key}`,
      );
    }
  }
});

Deno.test("city_id por coords (caja o ciudad más cercana)", () => {
  // Dentro de Culiacán
  const cul = cityIdForIncident(24.8, -107.4);
  assertEquals(cul.cityId, CITY_IDS.culiacan);

  // Dentro de Mazatlán
  const mzt = cityIdForIncident(23.25, -106.4);
  assertEquals(mzt.cityId, CITY_IDS.mazatlan);

  // Costa Rica (corredor norte, fuera de caja ciudad) → más cerca de Culiacán
  const costaRica = cityIdForIncident(24.55, -107.45);
  assertEquals(costaRica.cityId, CITY_IDS.culiacan);

  // Villa Unión-ish (fuera de caja MZT) → más cerca de Mazatlán
  const vu = cityIdForIncident(23.4, -106.3);
  assertEquals(vu.cityId, CITY_IDS.mazatlan);
});

Deno.test("fail-safe despejado: solo bboxes OK; si todos fallan, nada", () => {
  const active = [
    { id: "a", external_id: "tt-1", lat: 24.8, lng: -107.4 }, // Culiacán box
    { id: "b", external_id: "tt-2", lat: 23.95, lng: -107.02 }, // corridor_c
    { id: "c", external_id: "tt-3", lat: 23.25, lng: -106.4 }, // Mazatlán
  ];
  const culBox = TOMTOM_BBOXES.find((b) => b.key === "culiacan")!.bbox;
  const midBox = TOMTOM_BBOXES.find((b) => b.key === "corridor_c")!.bbox;

  // Ningún bbox OK → no despejar
  assertEquals(
    selectIncidentsToResolve({
      active,
      seenIds: new Set(),
      successfulBboxes: [],
    }),
    [],
  );

  // Solo Culiacán OK y no vimos tt-1 → despeja a; tt-2/tt-3 fuera de cobertura OK
  assertEquals(
    selectIncidentsToResolve({
      active,
      seenIds: new Set(),
      successfulBboxes: [culBox],
    }),
    ["a"],
  );

  // Culiacán + centro OK; vimos tt-1; tt-2 ausente → despeja b
  assertEquals(
    selectIncidentsToResolve({
      active,
      seenIds: new Set(["tt-1"]),
      successfulBboxes: [culBox, midBox],
    }),
    ["b"],
  );

  // Vistos todos los cubiertos → nada
  assertEquals(
    selectIncidentsToResolve({
      active,
      seenIds: new Set(["tt-1", "tt-2"]),
      successfulBboxes: [culBox, midBox],
    }),
    [],
  );

  assertEquals(pointInBbox(24.8, -107.4, culBox), true);
});

Deno.test("freshness + plan notify (máx 2 o digest)", () => {
  const now = Date.parse("2026-10-10T15:00:00Z");
  assertEquals(isFreshTomtomIncident("2026-10-10T14:45:00Z", now), true);
  assertEquals(isFreshTomtomIncident("2026-10-10T14:00:00Z", now), false);
  assertEquals(isFreshTomtomIncident(null, now), true);

  const mk = (id: string) => ({
    postId: id,
    externalId: id,
    lat: 24.8,
    lng: -107.4,
    cityId: CITY_IDS.culiacan,
    category: "bloqueo",
    title: id,
    placeLabel: "Culiacán",
  });

  assertEquals(planTomtomNotifiesPerUser([mk("1")]).length, 1);
  assertEquals(planTomtomNotifiesPerUser([mk("1"), mk("2")]).length, 2);
  const digest = planTomtomNotifiesPerUser([mk("1"), mk("2"), mk("3")]);
  assertEquals(digest.length, 1);
  assertEquals(digest[0].length, 3);
});

Deno.test("fixture incidentDetails v5 → parse + punto + categorías", () => {
  const feats = parseIncidentDetails(FIXTURE_INCIDENT_DETAILS);
  assertEquals(feats.length, 3);

  const accident = feats[0];
  assertEquals(accident.properties?.id, "tt-fixture-accident-elota-001");
  assertEquals(mapTomtomCategory(accident.properties?.iconCategory).category, "accidente");
  const pt = pointFromIncidentGeometry(accident.geometry);
  assertEquals(pt?.lat, 23.95);
  assertEquals(pt?.lng, -107.02);

  const closure = feats[1];
  assertEquals(mapTomtomCategory(closure.properties?.iconCategory).category, "bloqueo");
  const mid = pointFromIncidentGeometry(closure.geometry);
  assertEquals(mid?.lat, 23.72);
  assertEquals(mid?.lng, -106.78);

  const text = calmIncidentText({
    iconCategory: closure.properties?.iconCategory,
    description: closure.properties?.events?.[0]?.description,
    from: closure.properties?.from,
    to: closure.properties?.to,
    placeLabel: "México 15 / 15D",
  });
  assertStringIncludes(text, "Carril cerrado");
});

Deno.test("fixture flowSegmentData → minutos extra", () => {
  assertEquals(extraMinutesFromFlow(FIXTURE_FLOW_SEGMENT), 7);
});

Deno.test("fixture calculateRoute → ETA + alterna", () => {
  const r = parseCalculateRoute(FIXTURE_CALCULATE_ROUTE);
  assertEquals(r?.travelTimeMinutes, 168);
  assertEquals(r?.trafficDelayMinutes, 18);
  assertEquals(r?.lengthKm, 218.4);
  assertEquals(r?.alternates.length, 1);
  assertEquals(r?.alternates[0].travelTimeMinutes, 195);
  assertEquals(Array.isArray(r?.points), true);
});

Deno.test("viaje libre: México, distancia, muestras y cache key", () => {
  assertEquals(isInMexico(24.8, -107.4), true);
  assertEquals(isInMexico(40.7, -74.0), false); // NYC
  // Frontera: rechazar fuera de México
  assertEquals(isInMexico(31.7619, -106.485), false); // El Paso
  assertEquals(isInMexico(32.7157, -117.1611), false); // San Diego
  assertEquals(isInMexico(14.6349, -90.5069), false); // Guatemala City
  assertEquals(isInMexico(31.6904, -106.4245), true); // Juárez
  assertEquals(isInMexico(32.5149, -117.0382), true); // Tijuana
  assertEquals(MAX_TRIP_LENGTH_KM, 1500);
  assertEquals(TRIP_ROUTE_CHIPS.length, 4);
  assertEquals(NON_PRESET_POI_SAMPLES, 4);
  assertEquals(TOMTOM_DAILY_NON_PRESET_CAP, 1800);
  assertEquals(
    tripPoiKindsForBudget({ preset: false, dailyCount: 0 }).includes("ev_charging"),
    true,
  );
  assertEquals(
    tripPoiKindsForBudget({ preset: false, dailyCount: 1800 }).includes("ev_charging"),
    false,
  );

  const ok = validateTripEndpoints(
    { lat: 24.8091, lng: -107.394 },
    { lat: 23.2494, lng: -106.4111 },
  );
  assertEquals(ok.ok, true);
  if (ok.ok) assertEquals(ok.distanceKm > 100, true);

  assertEquals(
    validateTripEndpoints({ lat: 19.4, lng: -99.1 }, { lat: 25.7, lng: -100.3 }).ok,
    true,
  ); // CDMX→MTY
  assertEquals(
    validateTripEndpoints({ lat: 19.4, lng: -99.1 }, { lat: 34.05, lng: -118.2 }).ok,
    false,
  ); // LA fuera
  // Tijuana → Cancún ~3 200 km en línea recta
  const far = validateTripEndpoints(
    { lat: 32.5149, lng: -117.0382 },
    { lat: 21.1619, lng: -86.8515 },
  );
  assertEquals(far.ok, false);
  if (!far.ok) assertEquals(far.error, "too_far");

  assertEquals(
    isKnownMex15dTrip(
      { lat: 24.81, lng: -107.39 },
      { lat: 23.25, lng: -106.41 },
    ),
    true,
  );
  assertEquals(
    isKnownMex15dTrip(
      { lat: 24.81, lng: -107.39 },
      { lat: 20.66, lng: -103.35 },
    ),
    false,
  );

  const line = [
    { lat: 24.8, lng: -107.4 },
    { lat: 24.4, lng: -107.3 },
    { lat: 24.0, lng: -107.1 },
    { lat: 23.5, lng: -106.7 },
    { lat: 23.25, lng: -106.41 },
  ];
  const samples = sampleAlongPolyline(line, 50, 8);
  assertEquals(samples.length >= 2, true);
  assertEquals(samples[0].lat, 24.8);
  assertEquals(samples[samples.length - 1].lat, 23.25);

  const key = tripCacheKey("route", { lat: 24.8091, lng: -107.394 }, {
    lat: 23.2494,
    lng: -106.4111,
  });
  assertEquals(key.startsWith("route:trip:v1:"), true);
  assertEquals(placesCacheKey("Culiacán Centro").includes("culiacan"), true);
  assertEquals(PLACES_QUERY_MAX_LEN, 64);
  assertEquals(normalizePlacesQuery("a".repeat(100)).length, 64);
  assertEquals(
    placesCacheKey("x".repeat(80)),
    placesCacheKey("x".repeat(64)),
  );

  assertEquals(isTravelCommunityRowAllowed({ category_guess: "bloqueo" }), true);
  assertEquals(isTravelCommunityRowAllowed({ category_guess: "operativo" }), false);
  assertEquals(isTravelCommunityRowAllowed({ category: "operativo" }), false);

  const fuzzy = parseFuzzySearch({
    results: [
      {
        address: { freeformAddress: "Culiacán, Sinaloa", municipality: "Culiacán", countryCode: "MX" },
        position: { lat: 24.81, lon: -107.39 },
      },
      {
        address: { freeformAddress: "New York" },
        position: { lat: 40.7, lon: -74.0 },
      },
    ],
  });
  assertEquals(fuzzy.length, 1);
  assertEquals(fuzzy[0].name.includes("Culiacán"), true);
});

Deno.test("fixture nearbySearch → POIs", () => {
  const pois = parseNearbySearch(FIXTURE_NEARBY_GAS);
  assertEquals(pois.length, 2);
  assertEquals(pois[0].name, "Pemex Costa Rica");
  assertEquals(pois[0].distKm, 0.4);
});

Deno.test("rate limit keys / IP header", () => {
  assertEquals(TOMTOM_TRAVEL_RATE.maxPerIp > 0, true);
  const bucket = rateLimitBucket(1_700_000_000_000, 300);
  assertEquals(rateLimitCacheKey("ip", "1.2.3.4", bucket).startsWith("ratelimit:ip:"), true);
  // Último hop de x-forwarded-for (proxy de confianza)
  assertEquals(
    clientIpFromHeaders(new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" })),
    "10.0.0.1",
  );
  assertEquals(
    clientIpFromHeaders(new Headers({
      "cf-connecting-ip": "198.51.100.7",
      "x-forwarded-for": "203.0.113.9, 10.0.0.1",
    })),
    "198.51.100.7",
  );
});

Deno.test("viaje: operativo nunca en pulsos del travel", () => {
  assertEquals(
    isTravelCommunityRowAllowed({
      category_guess: "operativo",
      category: "operativo",
    }),
    false,
  );
  assertEquals(isTravelCommunityRowAllowed({ category_guess: "accidente" }), true);
});

Deno.test("POI: categorías, radio, cache v6, filtro y round-robin", () => {
  assertEquals(TOMTOM_POI_CATEGORIES.gas_station, "7311");
  assertEquals(TOMTOM_POI_CATEGORIES.ev_charging, "7309");
  assertEquals(TOMTOM_POI_CATEGORIES.hospital, "7321");
  assertEquals(TOMTOM_POI_CATEGORIES.pharmacy, "7326");
  assertEquals(TOMTOM_POI_CATEGORIES.toll, "7375");
  assertEquals(TOMTOM_POI_MAX_RADIUS_M, 50_000);
  assertEquals(TOMTOM_POI_CACHE_KEY, "poi:corridor:v6");
  assertEquals(TOMTOM_POI_CACHE_TTL_EMPTY_SEC, 10 * 60);
  assertEquals(TOMTOM_POI_REQUEST_GAP_MS, 250);
  assertEquals(TOMTOM_POI_SAMPLE_POINTS.length, 3);
  assertEquals(POI_DEDUPE_METERS, 300);
  assertEquals(EV_NAME_DEDUPE_METERS, 2000);
  assertEquals(TOLL_NEAR_CURATED_KM, 1);
  assertEquals(CURATED_MEX15D_TOLL_BOOTHS.length, 4);

  assertEquals(poiCacheTtlSeconds({ empty: false, anyFailed: false }), 6 * 3600);
  assertEquals(poiCacheTtlSeconds({ empty: true, anyFailed: false }), 10 * 60);
  assertEquals(poiCacheTtlSeconds({ empty: false, anyFailed: true }), 10 * 60);

  assertEquals(
    poiMatchesExpectedCategory("hospital", {
      name: "Hospital General",
      categoryIds: [7321],
      categories: ["hospital"],
    }),
    true,
  );
  assertEquals(
    poiMatchesExpectedCategory("hospital", {
      name: "Taller Mecánico El Rayo",
      categoryIds: [7310],
      categories: ["repair facility"],
    }),
    false,
  );
  assertEquals(
    poiMatchesExpectedCategory("ev_charging", {
      name: "Cargador Tesla",
      categoryIds: [7309],
      categories: ["electric vehicle station"],
    }),
    true,
  );

  const plan = buildPoiFetchPlan();
  assertEquals(plan.length, 5 * 3);
  assertEquals(plan[0].kind, "gas_station");
  assertEquals(plan[0].pointIndex, 0);

  const bySample = [
    [
      { name: "A1", lat: 24.7, lng: -107.4, distKm: 0.1 },
      { name: "A2", lat: 24.71, lng: -107.41, distKm: 0.2 },
      { name: "A3", lat: 24.72, lng: -107.42, distKm: 0.3 },
    ],
    [
      { name: "B1", lat: 23.95, lng: -107.02, distKm: 0.1 },
      { name: "B2", lat: 23.96, lng: -107.03, distKm: 0.2 },
    ],
    [{ name: "C1", lat: 23.28, lng: -106.35, distKm: 0.1 }],
  ];
  const picked = pickPoisRoundRobinBySample(bySample, 5);
  assertEquals(picked.length, 5);
  assertEquals(picked.map((p) => p.name), ["A1", "B1", "C1", "A2", "B2"]);

  assertEquals(
    poiListsAreEmpty({
      gas_station: [],
      ev_charging: [],
      hospital: [],
      pharmacy: [],
      toll: [],
    }),
    true,
  );
});

Deno.test("POI calidad: gas sin talleres, peajes curados, EV dedupe 2 km", () => {
  // Gas: talleres aunque vengan con categorySet 7311
  assertEquals(
    poiMatchesExpectedCategory("gas_station", {
      name: "Taller José Natividad",
      categoryIds: [7311],
      categories: ["petrol station", "repair facility"],
    }),
    false,
  );
  assertEquals(
    poiMatchesExpectedCategory("gas_station", {
      name: "Pemex Costa Rica",
      categoryIds: [7311],
      categories: ["petrol station"],
    }),
    true,
  );

  // Toll: curadas siempre; Navolato / Concordia fuera; OSM libramiento incluido
  assertEquals(isGenericTollName("Culiacán"), true);
  assertEquals(nameHasCasetaOrPlaza("Caseta Costa Rica"), true);
  assertEquals(nameHasCasetaOrPlaza("98 La Concordia"), false);
  assertEquals(isNearCuratedToll(24.5702, -107.4302), true);
  assertEquals(isNearCuratedToll(24.63, -107.4), false); // Navolato-ish lejos
  assertEquals(
    CURATED_MEX15D_TOLL_BOOTHS.some((b) => b.name.includes("Libramiento")),
    true,
  );

  const merged = mergeCuratedTolls([
    { name: "Navolato", lat: 24.63, lng: -107.7, distKm: 5 },
    { name: "98 La Concordia", lat: 24.2, lng: -107.0, distKm: 8 },
    { name: "Caseta Costa Rica TomTom", lat: 24.5705, lng: -107.4305, distKm: 0.1 },
    { name: "Caseta Extra Nombrada", lat: 23.8, lng: -106.9, distKm: 2 },
  ]);
  assertEquals(merged.length >= 4, true);
  assertEquals(merged.slice(0, 4).map((p) => p.name), [
    "Caseta Costa Rica (MEX-15D)",
    "Caseta Quilá (MEX-15D)",
    "Caseta Mármol (MEX-15D)",
    "Caseta Libramiento Culiacán",
  ]);
  assertEquals(merged.some((p) => p.name === "Navolato"), false);
  assertEquals(merged.some((p) => p.name.includes("Concordia")), false);
  // Duplicado cerca de Costa Rica no se añade
  assertEquals(merged.some((p) => p.name.includes("TomTom")), false);
  // Nombre con caseta lejos de curadas sí se añade
  assertEquals(merged.some((p) => p.name === "Caseta Extra Nombrada"), true);

  // EV: mismo nombre normalizado a ~1.1 km → 1 entrada
  const teslaA = { name: "Tesla", lat: 24.55, lng: -107.45, distKm: 0.1 };
  const teslaB = { name: "Tesla", lat: 24.56, lng: -107.45, distKm: 0.2 }; // ~1.11 km
  assertEquals(
    dedupePoisByNamePos([teslaA, teslaB], 5, "ev_charging").map((p) => p.name),
    ["Tesla"],
  );
  // Nombres distintos a ~200 m: el genérico ~300 m sigue aplicando en hospital etc.
  assertEquals(
    poisNearDuplicate(
      { name: "Tesla", lat: 24.55, lng: -107.45 },
      { name: "Tesla Supercharger", lat: 24.5515, lng: -107.4512 },
    ),
    true,
  );

  // Gas: mismo nombre + coords idénticas → 1; coords distintas → 2
  assertEquals(
    dedupePoisByNamePos([
      { name: "Pemex", lat: 24.55, lng: -107.45 },
      { name: "Pemex", lat: 24.55, lng: -107.45 },
      { name: "Pemex", lat: 24.56, lng: -107.45 },
    ], 5, "gas_station").length,
    2,
  );

  const rr = pickPoisRoundRobinBySample([
    [teslaA],
    [teslaB],
    [{ name: "Otro EV", lat: 23.28, lng: -106.35, distKm: 0.5 }],
  ], 5, "ev_charging");
  assertEquals(rr.map((p) => p.name), ["Tesla", "Otro EV"]);
});

Deno.test("Aliados: categoría, corredor 2 km, merge + dedupe TomTom", () => {
  assertEquals(ALIADO_CORRIDOR_MAX_KM, 2);

  const farmacia = {
    id: "a1",
    name: "Farmacia del Corredor",
    description: "Promo vecinos",
    lat: 24.55,
    lng: -107.45,
    pinGiro: "farmacia",
    logoUrl: "https://example.com/logo.png",
  };
  assertEquals(aliadoMatchesPoiKind(farmacia, "pharmacy"), true);
  assertEquals(aliadoMatchesPoiKind(farmacia, "hospital"), false);
  assertEquals(minKmToCorridor(farmacia.lat, farmacia.lng) <= 2, true);

  const lejos = { ...farmacia, id: "a2", lat: 25.5, lng: -108.5 };
  assertEquals(minKmToCorridor(lejos.lat, lejos.lng) > 2, true);

  assertEquals(
    tomtomDuplicatesAliado(
      { name: "Farmacia del Corredor Dimas", lat: 24.5505, lng: -107.4505 },
      farmacia,
    ),
    true,
  );
  assertEquals(
    tomtomDuplicatesAliado(
      { name: "Otra cosa", lat: 24.6, lng: -107.5 },
      farmacia,
    ),
    false,
  );

  const merged = mergeAliadosIntoPois({
    tomtomPois: {
      gas_station: [],
      ev_charging: [],
      hospital: [],
      pharmacy: [
        { name: "Farmacia del Corredor Dimas", lat: 24.5504, lng: -107.4504, distKm: 0.3 },
        { name: "Farmacia Guadalajara", lat: 23.95, lng: -107.02, distKm: 1.1 },
      ],
      toll: [],
    },
    aliados: [farmacia, lejos],
  });
  assertEquals(merged.pharmacy[0].aliado, true);
  assertEquals(merged.pharmacy[0].badge, "Aliado Pulso");
  assertEquals(merged.pharmacy[0].promo, "Promo vecinos");
  assertEquals(merged.pharmacy[0].logoUrl, "https://example.com/logo.png");
  // TomTom duplicado eliminado; queda el otro TomTom
  assertEquals(merged.pharmacy.some((p) => p.name.includes("Guadalajara")), true);
  assertEquals(merged.pharmacy.filter((p) => p.source === "tomtom").length, 1);
  assertEquals(merged.pharmacy[0].source, "aliado");
});

Deno.test("travel endpoints: México libre + clamp legacy", () => {
  assertEquals(isAllowedTravelPoint({ lat: 24.8, lng: -107.4 }), true);
  assertEquals(isAllowedTravelPoint({ lat: 19.4, lng: -99.1 }), false); // CDMX fuera del corredor

  // Solo origen: destino cae al preset
  const ok = resolveTravelEndpoints({
    direction: "culiacan_to_mazatlan",
    origin: { lat: 24.81, lng: -107.39 },
    destination: null,
  });
  assertEquals(ok.originClamped, false);
  assertEquals(ok.destination.lat, 23.2494);

  // Ambos en México (CDMX→GDL): se aceptan sin clamp
  const free = resolveTravelEndpoints({
    direction: "culiacan_to_mazatlan",
    origin: { lat: 19.4, lng: -99.1 },
    destination: { lat: 20.7, lng: -103.3 },
    mexicoWide: true,
  });
  assertEquals(free.error, undefined);
  assertEquals(free.originClamped, false);
  assertEquals(free.origin.lat, 19.4);
  assertEquals(free.destination.lat, 20.7);

  // Fuera de México: error
  const out = resolveTravelEndpoints({
    direction: "culiacan_to_mazatlan",
    origin: { lat: 19.4, lng: -99.1 },
    destination: { lat: 34.05, lng: -118.2 },
    mexicoWide: true,
  });
  assertEquals(out.error, "outside_mexico");
});
