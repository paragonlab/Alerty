/**
 * Run: npx --yes tsx lib/alerty/city.test.ts
 */
import {
  ACTIVE_CITY_SLUG,
  CITIES,
  CITY_IDS,
  belongsToActiveCity,
  defaultBackfillCityId,
  getActiveCity,
  getActiveCityId,
  getActiveCityLabel,
  getActiveCityName,
  getActiveCitySlug,
  setCityPreference,
} from "./city";
import { CULIACAN_CENTER } from "./constants";
import { getOperativoCityPlaceLabel } from "./operativoPolicy";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function run() {
  setCityPreference(null);
  assert(ACTIVE_CITY_SLUG === "culiacan", "default slug is culiacan (prod path)");
  assert(getActiveCitySlug() === "culiacan", "active slug defaults to culiacan");
  assert(getActiveCityId() === CITY_IDS.culiacan, "active city id matches seed");
  assert(defaultBackfillCityId() === CITY_IDS.culiacan, "backfill default is culiacan");

  const c = getActiveCity();
  assert(c.name === "Culiacán", "active name");
  assert(c.state === "Sinaloa", "active state");
  assert(c.timezone === "America/Mazatlan", "culiacan timezone");
  assert(c.active === true, "culiacan is active");
  assert(
    c.center.latitude === CULIACAN_CENTER.latitude &&
      c.center.longitude === CULIACAN_CENTER.longitude,
    "CULIACAN_CENTER mirrors active city center",
  );

  const mz = CITIES.mazatlan;
  assert(mz.id === CITY_IDS.mazatlan, "mazatlan seed id");
  assert(mz.active === true, "mazatlan active for sync (fase 2)");
  assert(mz.timezone === "America/Mazatlan", "mazatlan same timezone");
  assert(mz.center.latitude > 23 && mz.center.latitude < 24, "mazatlan lat sane");
  assert(mz.center.longitude > -107 && mz.center.longitude < -106, "mazatlan lng sane");

  assert(belongsToActiveCity(CITY_IDS.culiacan), "culiacan belongs");
  assert(!belongsToActiveCity(CITY_IDS.mazatlan), "mazatlan does not belong while default active");
  assert(!belongsToActiveCity(null), "null city_id rejected");
  assert(!belongsToActiveCity(undefined), "undefined city_id rejected");

  assert(getActiveCityName() === "Culiacán", "name helper");
  assert(getActiveCityLabel() === "Culiacán, Sinaloa", "label helper");
  assert(
    getOperativoCityPlaceLabel() === getActiveCityName(),
    "operativo place label follows active city",
  );

  setCityPreference("mazatlan");
  assert(getActiveCitySlug() === "mazatlan", "preference switches slug");
  assert(getActiveCityId() === CITY_IDS.mazatlan, "preference switches id");
  assert(belongsToActiveCity(CITY_IDS.mazatlan), "mazatlan belongs after switch");
  assert(!belongsToActiveCity(CITY_IDS.culiacan), "culiacan excluded after switch");
  assert(getOperativoCityPlaceLabel() === "Mazatlán", "operativo label follows switch");
  setCityPreference(null);

  console.log("city tests ok");
}

run();
