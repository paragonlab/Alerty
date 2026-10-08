/**
 * Run: npx --yes tsx lib/alerty/cityFeeds.test.ts
 */
import { CITY_IDS } from "./city";
import { CITY_FEED_COLUMN, cityIdForFeedQuery, filterRowsByActiveCity } from "./cityFeeds";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function run() {
  assert(CITY_FEED_COLUMN === "city_id", "feed column name");
  assert(cityIdForFeedQuery() === CITY_IDS.culiacan, "feed query uses Culiacán");

  const rows = [
    { id: "1", city_id: CITY_IDS.culiacan },
    { id: "2", city_id: CITY_IDS.mazatlan },
    { id: "3", city_id: null },
  ];
  const filtered = filterRowsByActiveCity(rows);
  assert(filtered.length === 1 && filtered[0]!.id === "1", "only active city rows");
  assert(
    !filtered.some((r) => r.city_id === CITY_IDS.mazatlan),
    "mazatlan must not leak into culiacan feed",
  );

  console.log("cityFeeds tests ok");
}

run();
