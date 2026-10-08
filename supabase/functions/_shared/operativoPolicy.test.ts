/**
 * Run: deno test supabase/functions/_shared/operativoPolicy.test.ts
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { OPERATIVO_CITY_PLACE_LABEL, stripOperativoGeo } from "./operativoPolicy.ts";

Deno.test("stripOperativoGeo clears coords for operativo", () => {
  const row = stripOperativoGeo({
    category_guess: "operativo",
    lat: 24.8,
    lng: -107.4,
    place_label: "Chapultepec",
    geo_source: "text_colonia",
    place_name_source: "Chapultepec",
    geocoded_from_text: "Chapultepec",
  });
  assertEquals(row.lat, null);
  assertEquals(row.lng, null);
  assertEquals(row.place_label, OPERATIVO_CITY_PLACE_LABEL);
  assertEquals(row.geo_source, "none");
  assertEquals(row.place_name_source, null);
  assertEquals(row.geocoded_from_text, null);
});

Deno.test("stripOperativoGeo leaves other categories", () => {
  const row = stripOperativoGeo({
    category_guess: "balacera",
    lat: 24.8,
    lng: -107.4,
    place_label: "Centro",
    geo_source: "tweet_coords",
    place_name_source: null,
    geocoded_from_text: null,
  });
  assertEquals(row.lat, 24.8);
  assertEquals(row.place_label, "Centro");
});
