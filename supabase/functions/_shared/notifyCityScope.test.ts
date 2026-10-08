/**
 * Run: deno test supabase/functions/_shared/notifyCityScope.test.ts
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  filterTokensByAlertCity,
  filterZonesByAlertCity,
  tokenMatchesAlertCity,
} from "./notifyCityScope.ts";
import { CITY_IDS } from "./cities.ts";

const cul = CITY_IDS.culiacan;
const maz = CITY_IDS.mazatlan;

Deno.test("tokenMatchesAlertCity: same city", () => {
  assertEquals(
    tokenMatchesAlertCity(
      { user_id: "u1", token: "t", users: { city_id: cul } },
      cul,
    ),
    true,
  );
});

Deno.test("tokenMatchesAlertCity: other city rejected", () => {
  assertEquals(
    tokenMatchesAlertCity(
      { user_id: "u1", token: "t", users: { city_id: maz } },
      cul,
    ),
    false,
  );
});

Deno.test("tokenMatchesAlertCity: missing alert city → false", () => {
  assertEquals(
    tokenMatchesAlertCity(
      { user_id: "u1", token: "t", users: { city_id: cul } },
      null,
    ),
    false,
  );
});

Deno.test("filterTokensByAlertCity: only matching city", () => {
  const rows = [
    { user_id: "a", token: "ta", users: { city_id: cul } },
    { user_id: "b", token: "tb", users: { city_id: maz } },
    { user_id: "c", token: "tc", users: [{ city_id: cul }] },
  ];
  const filtered = filterTokensByAlertCity(rows, cul);
  assertEquals(filtered.map((r) => r.user_id), ["a", "c"]);
});

Deno.test("filterZonesByAlertCity: scopes Círculo", () => {
  const zones = [
    { user_id: "a", label: "Casa", lat: 24.8, lng: -107.4, city_id: cul },
    { user_id: "b", label: "Playa", lat: 23.2, lng: -106.4, city_id: maz },
  ];
  assertEquals(filterZonesByAlertCity(zones, cul).map((z) => z.label), ["Casa"]);
  assertEquals(filterZonesByAlertCity(zones, null), []);
});
