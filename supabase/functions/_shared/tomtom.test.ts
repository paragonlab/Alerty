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
  TOMTOM_POI_CACHE_KEY,
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
  extraMinutesFromFlow,
  isFreshTomtomIncident,
  isAllowedTravelPoint,
  mapTomtomCategory,
  mergeAliadosIntoPois,
  minKmToCorridor,
  parseCalculateRoute,
  parseIncidentDetails,
  parseNearbySearch,
  pickPoisRoundRobinBySample,
  planTomtomNotifiesPerUser,
  poiCacheTtlSeconds,
  poiListsAreEmpty,
  poiMatchesExpectedCategory,
  pointFromIncidentGeometry,
  pointInBbox,
  rateLimitBucket,
  rateLimitCacheKey,
  resolveTravelEndpoints,
  selectIncidentsToResolve,
  tomtomDuplicatesAliado,
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
  assertEquals(
    clientIpFromHeaders(new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" })),
    "203.0.113.9",
  );
});

Deno.test("POI: categorías, radio, cache v4, filtro y round-robin", () => {
  assertEquals(TOMTOM_POI_CATEGORIES.gas_station, "7311");
  assertEquals(TOMTOM_POI_CATEGORIES.ev_charging, "7309");
  assertEquals(TOMTOM_POI_CATEGORIES.hospital, "7321");
  assertEquals(TOMTOM_POI_CATEGORIES.pharmacy, "7326");
  assertEquals(TOMTOM_POI_CATEGORIES.toll, "7375");
  assertEquals(TOMTOM_POI_MAX_RADIUS_M, 50_000);
  assertEquals(TOMTOM_POI_CACHE_KEY, "poi:corridor:v4");
  assertEquals(TOMTOM_POI_CACHE_TTL_EMPTY_SEC, 10 * 60);
  assertEquals(TOMTOM_POI_REQUEST_GAP_MS, 250);
  assertEquals(TOMTOM_POI_SAMPLE_POINTS.length, 3);

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

Deno.test("travel endpoints: presets y clamp de puntos fuera de zona", () => {
  assertEquals(isAllowedTravelPoint({ lat: 24.8, lng: -107.4 }), true);
  assertEquals(isAllowedTravelPoint({ lat: 19.4, lng: -99.1 }), false); // CDMX

  const ok = resolveTravelEndpoints({
    direction: "culiacan_to_mazatlan",
    origin: { lat: 24.81, lng: -107.39 },
    destination: null,
  });
  assertEquals(ok.originClamped, false);
  assertEquals(ok.destination.lat, 23.2494);

  const clamped = resolveTravelEndpoints({
    direction: "culiacan_to_mazatlan",
    origin: { lat: 19.4, lng: -99.1 },
    destination: { lat: 20.7, lng: -103.3 },
  });
  assertEquals(clamped.originClamped, true);
  assertEquals(clamped.destinationClamped, true);
  assertEquals(clamped.origin.lat, 24.8091);
  assertEquals(clamped.destination.lat, 23.2494);
});
