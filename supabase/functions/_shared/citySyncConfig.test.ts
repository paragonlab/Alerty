/**
 * Run: deno test --allow-env supabase/functions/_shared/citySyncConfig.test.ts
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  CITY_SYNC,
  DEFAULT_SYNC_CITY_SLUGS,
  isOtherCityStoryFor,
  mentionsCity,
  parseSyncCitySlugs,
} from "./citySyncConfig.ts";
import { CITY_IDS } from "./cities.ts";

Deno.test("sync stamps: each city has its own city_id", () => {
  assertEquals(CITY_SYNC.culiacan.cityId, CITY_IDS.culiacan);
  assertEquals(CITY_SYNC.mazatlan.cityId, CITY_IDS.mazatlan);
  assertEquals(DEFAULT_SYNC_CITY_SLUGS.includes("culiacan"), true);
  assertEquals(DEFAULT_SYNC_CITY_SLUGS.includes("mazatlan"), true);
});

Deno.test("Culiacán path rejects Mazatlán-only stories", () => {
  const cfg = CITY_SYNC.culiacan;
  assertEquals(
    isOtherCityStoryFor("Reportan bloqueo en el centro de Mazatlán esta tarde.", cfg),
    true,
  );
  assertEquals(
    isOtherCityStoryFor("Balacera en colonia Guadalupe, Culiacán.", cfg),
    false,
  );
  assertEquals(mentionsCity("algo en Culiacán", cfg), true);
});

Deno.test("Mazatlán path accepts Mazatlán and rejects Culiacán-only", () => {
  const cfg = CITY_SYNC.mazatlan;
  assertEquals(
    isOtherCityStoryFor("Reportan bloqueo en el centro de Mazatlán esta tarde.", cfg),
    false,
  );
  assertEquals(
    isOtherCityStoryFor("Balacera en colonia Guadalupe, Culiacán.", cfg),
    true,
  );
  assertEquals(mentionsCity("oleaje en Mazatlán", cfg), true);
  assertEquals(
    isOtherCityStoryFor("Operativo en Mazatlán y menciones de Culiacán en el mismo texto", cfg),
    false,
  );
});

Deno.test("parseSyncCitySlugs", () => {
  assertEquals(parseSyncCitySlugs(undefined), DEFAULT_SYNC_CITY_SLUGS);
  assertEquals(parseSyncCitySlugs("mazatlan"), ["mazatlan"]);
  assertEquals(parseSyncCitySlugs("culiacan,mazatlan"), ["culiacan", "mazatlan"]);
});
