/**
 * deno test --allow-env supabase/functions/_shared/tomtom.test.ts
 */
import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  TOMTOM_BUDGET,
  TOMTOM_TRAVEL_RATE,
  calmIncidentText,
  clientIpFromHeaders,
  extraMinutesFromFlow,
  mapTomtomCategory,
  parseCalculateRoute,
  parseIncidentDetails,
  parseNearbySearch,
  pointFromIncidentGeometry,
  rateLimitBucket,
  rateLimitCacheKey,
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
  assertEquals(TOMTOM_BUDGET.estimatedIncidentRequestsPerDay <= 250, true);
  assertEquals(
    TOMTOM_BUDGET.estimatedIncidentRequestsPerDay +
      TOMTOM_BUDGET.estimatedFlowRequestsPerDay <
      TOMTOM_BUDGET.freeNonTilePerDay,
    true,
  );
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
  // (780-360)/60 = 7
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
