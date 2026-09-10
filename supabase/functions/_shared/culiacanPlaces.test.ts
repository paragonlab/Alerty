/**
 * Deno tests for resolveCommunityGeo (publisher place vs body colonia).
 * Run from repo root:
 *   deno test --allow-read supabase/functions/_shared/culiacanPlaces.test.ts
 */
import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolveCommunityGeo, resolveTextColonia } from "./culiacanPlaces.ts";

Deno.test("prefers body colonia Adolfo López Mateos over publisher Guadalupe place", () => {
  const geo = resolveCommunityGeo({
    text: "El incidente ocurrió en la colonia Adolfo López Mateos, Culiacán.",
    placeBboxCenter: { lat: 24.7997, lng: -107.4068 },
    publisherPlaceLabel: "Guadalupe, Culiacán",
    fallbackLabel: "Culiacán (X)",
  });
  assertEquals(geo.geoSource, "text_colonia");
  assertEquals(geo.placeLabel, "Adolfo López Mateos");
  assertEquals(geo.geocodedFromText, "Adolfo López Mateos");
  assertEquals(geo.placeNameSource, "Guadalupe, Culiacán");
  assertEquals(geo.mapEligible, true);
  assertExists(geo.lat);
  assertExists(geo.lng);
});

Deno.test("city-only place + colonia in text → text_colonia", () => {
  const geo = resolveCommunityGeo({
    text: "Reportan accidente en colonia Las Quintas",
    placeBboxCenter: { lat: 24.8, lng: -107.39 },
    publisherPlaceLabel: "Culiacán, Sinaloa",
    fallbackLabel: "Culiacán (X)",
  });
  assertEquals(geo.geoSource, "text_colonia");
  assertEquals(geo.placeLabel, "Las Quintas");
});

Deno.test("ambiguous multi-colonia text → no map pin", () => {
  const geo = resolveCommunityGeo({
    text: "Hay reportes en Guadalupe y en Chapultepec esta tarde.",
    fallbackLabel: "Culiacán (X)",
  });
  assertEquals(geo.mapEligible, false);
  assertEquals(geo.lat, null);
  assertEquals(geo.geoSource, "none");
});

Deno.test("precise tweet coords win when text colonia matches publisher", () => {
  const geo = resolveCommunityGeo({
    text: "Estoy en colonia Guadalupe, todo tranquilo por ahora.",
    coords: { lat: 24.801, lng: -107.407 },
    publisherPlaceLabel: "Guadalupe",
    fallbackLabel: "Culiacán (X)",
  });
  assertEquals(geo.geoSource, "tweet_coords");
  assertEquals(geo.lat, 24.801);
});

Deno.test("resolveTextColonia high confidence on ocurrió en", () => {
  const hit = resolveTextColonia("La balacera ocurrió en la colonia Guadalupe");
  assertEquals(hit?.place.name, "Guadalupe");
  assertEquals(hit?.confidence, "high");
  assertEquals(hit?.ambiguous, false);
});

Deno.test("RSS city-only Culiacán stays off the map (no fake downtown pin)", () => {
  const geo = resolveCommunityGeo({
    text: "Reportan balacera en Culiacán esta tarde.",
    title: "Balacera en Culiacán",
    fallbackLabel: "Culiacán (noticia)",
    allowCityApprox: false,
    requireCuliacanMention: true,
  });
  assertEquals(geo.mapEligible, false);
  assertEquals(geo.lat, null);
});

Deno.test("RSS Mazatlán story is not pinned in Culiacán", () => {
  const geo = resolveCommunityGeo({
    text: "Reportan bloqueo en el centro de Mazatlán esta tarde.",
    title: "Bloqueo en Mazatlán",
    fallbackLabel: "Culiacán (noticia)",
    allowCityApprox: true,
    requireCuliacanMention: true,
  });
  assertEquals(geo.mapEligible, false);
  assertEquals(geo.lat, null);
});

Deno.test("RSS Culiacán + colonia pins at that colonia", () => {
  const geo = resolveCommunityGeo({
    text: "El incidente ocurrió en la colonia Las Quintas, Culiacán.",
    title: "Balacera en Las Quintas",
    fallbackLabel: "Culiacán (noticia)",
    allowCityApprox: false,
    requireCuliacanMention: true,
  });
  assertEquals(geo.mapEligible, true);
  assertEquals(geo.placeLabel, "Las Quintas");
  assertEquals(geo.geoSource, "text_colonia");
});

Deno.test("ambiguous colonias stay off the map even with city approx", () => {
  const geo = resolveCommunityGeo({
    text: "Hay reportes en Guadalupe y en Chapultepec esta tarde.",
    fallbackLabel: "Sinaloa (noticia)",
    allowCityApprox: true,
  });
  assertEquals(geo.mapEligible, false);
  assertEquals(geo.lat, null);
});

Deno.test("NMás sentence: colonia Lomas del Bulevar → text_colonia (not Boulevares)", () => {
  const hit = resolveTextColonia("balacera en la colonia Lomas del Bulevar");
  assertEquals(hit?.place.name, "Lomas del Bulevar");
  assertEquals(hit?.confidence, "high");
  assertEquals(hit?.ambiguous, false);

  const geo = resolveCommunityGeo({
    text: "balacera en la colonia Lomas del Bulevar",
    placeBboxCenter: { lat: 24.81, lng: -107.39 },
    publisherPlaceLabel: "Culiacán, Sinaloa",
    fallbackLabel: "Culiacán (X)",
  });
  assertEquals(geo.geoSource, "text_colonia");
  assertEquals(geo.placeLabel, "Lomas del Bulevar");
  assertEquals(geo.lat, 24.7898);
  assertEquals(geo.lng, -107.4253);
  assertEquals(geo.mapEligible, true);
});

Deno.test("Lomas del Boulevard spelling alias", () => {
  const hit = resolveTextColonia(
    "Reportan enfrentamiento en la colonia Lomas del Boulevard, Culiacán.",
  );
  assertEquals(hit?.place.name, "Lomas del Bulevar");
  assertEquals(hit?.confidence, "high");
});