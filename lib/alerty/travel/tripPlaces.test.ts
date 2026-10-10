/**
 * Run: npx tsx lib/alerty/travel/tripPlaces.test.ts
 */
import {
  isMex15dChip,
  swapTrip,
  travelDirectionFromTrip,
  TRIP_ROUTE_CHIPS,
} from "./tripPlaces";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function run() {
  assert(TRIP_ROUTE_CHIPS.length === 4, "4 chips");
  const chip = TRIP_ROUTE_CHIPS[0];
  assert(isMex15dChip(chip.origin, chip.destination), "CUL-MZT known");
  assert(
    travelDirectionFromTrip(chip.origin, chip.destination) === "culiacan_to_mazatlan",
    "direction CUL→MZT",
  );
  assert(
    travelDirectionFromTrip(chip.destination, chip.origin) === "mazatlan_to_culiacan",
    "direction MZT→CUL",
  );
  assert(
    travelDirectionFromTrip(TRIP_ROUTE_CHIPS[3].origin, TRIP_ROUTE_CHIPS[3].destination) ===
      null,
    "GDL no es mex15d",
  );

  const swapped = swapTrip(chip.origin, chip.destination);
  assert(swapped.origin?.name === "Mazatlán", "swap origin");
  assert(swapped.destination?.name === "Culiacán", "swap dest");

  console.log("tripPlaces.test.ts: ok");
}

run();
