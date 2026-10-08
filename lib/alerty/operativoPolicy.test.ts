/**
 * Run: npx --yes tsx lib/alerty/operativoPolicy.test.ts
 */
import {
  OPERATIVO_CITY_PLACE_LABEL,
  OPERATIVO_FEED_DELAY_MS,
  isCommunityMapEligibleCategory,
  isOperativoCategory,
  isOperativoFeedReady,
  redactOperativoLocation,
} from "./operativoPolicy";
import { isCommunityFeedVisible } from "./utils";
import { resolveCommunityMapPoint } from "./coloniaGeocode";
import type { CommunityPost } from "./types";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const post = (over: Partial<CommunityPost> = {}): CommunityPost => ({
  id: "p1",
  source: "x",
  externalId: "1",
  authorHandle: "@test",
  text: "Despliegue de militares en Chapultepec",
  url: "https://example.com",
  lat: 24.8175,
  lng: -107.3783,
  placeLabel: "Chapultepec",
  geoSource: "text_colonia",
  placeNameSource: "Chapultepec",
  geocodedFromText: "Chapultepec",
  createdAt: new Date(Date.now() - OPERATIVO_FEED_DELAY_MS - 60_000).toISOString(),
  fetchedAt: new Date().toISOString(),
  categoryGuess: "operativo",
  isDemo: false,
  trustTier: "community",
  ...over,
});

function run() {
  assert(OPERATIVO_FEED_DELAY_MS === 2 * 60 * 60 * 1000, "delay is 2 hours");
  assert(isOperativoCategory("operativo"), "detects operativo");
  assert(!isOperativoCategory("balacera"), "other categories ok");
  assert(!isCommunityMapEligibleCategory("operativo"), "operativo never map-eligible");
  assert(isCommunityMapEligibleCategory("balacera"), "balacera map-eligible");

  const fresh = new Date().toISOString();
  assert(!isOperativoFeedReady(fresh), "fresh operativo hidden from feed");
  assert(
    isOperativoFeedReady(new Date(Date.now() - OPERATIVO_FEED_DELAY_MS).toISOString()),
    "ready exactly at delay",
  );

  const redacted = redactOperativoLocation(post());
  assert(redacted.lat === null && redacted.lng === null, "redact clears coords");
  assert(redacted.placeLabel === OPERATIVO_CITY_PLACE_LABEL, "redact city label");
  assert(redacted.geoSource === "none", "redact geo_source");
  assert(redacted.geocodedFromText === null, "redact colonia text");

  const kept = redactOperativoLocation(post({ categoryGuess: "balacera" }));
  assert(kept.lat === 24.8175, "non-operativo keeps coords");

  // Mapa: ni coords ni geocode de texto para operativo.
  assert(
    resolveCommunityMapPoint(post()) === null,
    "resolveCommunityMapPoint blocks operativo with coords",
  );
  assert(
    resolveCommunityMapPoint(post({ lat: null, lng: null })) === null,
    "resolveCommunityMapPoint blocks operativo text geocode",
  );

  const active = ["balacera", "alerta", "otro"];
  assert(
    !isCommunityFeedVisible(post({ createdAt: fresh }), "7d", active),
    "feed hides fresh operativo",
  );
  assert(
    isCommunityFeedVisible(post(), "7d", active),
    "feed shows delayed operativo even without chip",
  );
  assert(
    isCommunityFeedVisible(post({ categoryGuess: "balacera", createdAt: fresh }), "7d", active),
    "balacera still uses category filter",
  );
  assert(
    !isCommunityFeedVisible(
      post({ categoryGuess: "incendio", createdAt: fresh }),
      "7d",
      active,
    ),
    "inactive category stays hidden",
  );

  console.log("operativoPolicy.test.ts: ok");
}

run();
